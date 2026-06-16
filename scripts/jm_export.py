#!/usr/bin/env python3
"""
JM 本子导出脚本，供 Node bot 子进程调用。
流程：jmcomic 下载分张 → PIL 竖向拼接为一张长图 → 压缩为 longimg.jpg → 删除原分张。
依赖：pip install jmcomic pillow -U
"""
from __future__ import annotations

import json
import os
import re
import sys
import traceback
from pathlib import Path


def emit_error(message: str, code: int = 1) -> None:
    sys.stdout = _REAL_STDOUT
    print(json.dumps({"ok": False, "error": message}, ensure_ascii=False), flush=True)
    sys.exit(code)


class _StdoutToStderr:
    """将 jmcomic 日志重定向到 stderr，避免污染 stdout 中的 JSON 结果。"""

    def write(self, data: str) -> None:
        if data:
            sys.stderr.write(data)

    def flush(self) -> None:
        sys.stderr.flush()


_REAL_STDOUT = sys.stdout


def configure_pillow() -> None:
    """放宽 Pillow 像素上限（服务端可信来源），避免长图拼接触发 decompression bomb 限制。"""
    from PIL import Image

    raw = os.environ.get("JM_LONGIMG_MAX_PIXELS", "none").strip().lower()
    if raw in ("none", "0", "unlimited", ""):
        Image.MAX_IMAGE_PIXELS = None
    else:
        Image.MAX_IMAGE_PIXELS = max(int(raw), 178_956_970)


def natural_sort_key(text: str) -> list:
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", text)]


def find_first_file(directory: Path, suffix: str) -> str | None:
    files = sorted(directory.glob(f"*{suffix}"))
    if not files:
        files = sorted(directory.rglob(f"*{suffix}"))
    return str(files[0]) if files else None


def resolve_download_base(option_path: str, option) -> Path:
    base_dir = getattr(getattr(option, "dir_rule", None), "base_dir", "./data/jm/downloads")
    base = Path(str(base_dir))
    if not base.is_absolute():
        project_root = Path(option_path).resolve().parent.parent
        base = (project_root / base).resolve()
    return base


def collect_album_page_images(base_dir: Path, album_id: str) -> list[Path]:
    """收集本子下载目录下的分张图片（按路径与文件名自然排序）。"""
    patterns = ("*.jpg", "*.jpeg", "*.png", "*.webp")
    images: list[Path] = []

    if not base_dir.exists():
        return images

    for pattern in patterns:
        for path in base_dir.rglob(pattern):
            if not path.is_file():
                continue
            posix = path.as_posix()
            if album_id not in posix:
                continue
            name = path.name.lower()
            if name.startswith("longimg") or name == "album.pdf":
                continue
            images.append(path)

    return sorted(set(images), key=lambda p: (natural_sort_key(str(p.parent)), natural_sort_key(p.name)))


# JPEG 编码单边长度上限（超过则改用 PNG）
JPEG_MAX_SIDE = 65500


def _scaled_image(canvas, scale: float, resample):
    if scale >= 0.999:
        return canvas
    w, h = canvas.size
    return canvas.resize(
        (max(1, int(w * scale)), max(1, int(h * scale))),
        resample,
    )


def save_canvas_as_longimg(canvas, job_dir: Path, resample) -> str:
    """保存拼接长图：尺寸在 JPEG 限制内优先 JPG，否则或失败时改用 PNG。"""
    max_bytes = int(os.environ.get("JM_LONGIMG_MAX_BYTES", str(50 * 1024 * 1024)))
    quality_start = int(os.environ.get("JM_LONGIMG_JPEG_QUALITY", "90"))
    job_dir.mkdir(parents=True, exist_ok=True)

    qualities: list[int] = []
    q = quality_start
    while q >= 55:
        qualities.append(q)
        q -= 5

    scales = (1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6)
    cw, ch = canvas.size
    prefer_png = cw > JPEG_MAX_SIDE or ch > JPEG_MAX_SIDE

    if not prefer_png:
        output_jpg = job_dir / "longimg.jpg"
        for scale in scales:
            target = _scaled_image(canvas, scale, resample)
            tw, th = target.size
            if tw > JPEG_MAX_SIDE or th > JPEG_MAX_SIDE:
                if target is not canvas:
                    target.close()
                prefer_png = True
                break
            for quality in qualities:
                try:
                    # 超大图禁用 optimize，避免 broken data stream
                    target.save(
                        output_jpg,
                        format="JPEG",
                        quality=quality,
                        optimize=False,
                        progressive=False,
                    )
                    if output_jpg.stat().st_size <= max_bytes:
                        if target is not canvas:
                            target.close()
                        return str(output_jpg)
                except OSError as exc:
                    sys.stderr.write(f"[jm] JPEG 保存失败，改用 PNG: {exc}\n")
                    prefer_png = True
                    break
            if prefer_png:
                if target is not canvas:
                    target.close()
                break
            if target is not canvas:
                target.close()

    output_png = job_dir / "longimg.png"
    last_error: Exception | None = None

    for scale in scales:
        target = _scaled_image(canvas, scale, resample)
        for compress_level in (6, 7, 8, 9):
            try:
                target.save(
                    output_png,
                    format="PNG",
                    compress_level=compress_level,
                    optimize=True,
                )
                size = output_png.stat().st_size
                if size <= max_bytes:
                    if target is not canvas:
                        target.close()
                    return str(output_png)
                last_error = None
            except OSError as exc:
                last_error = exc
                sys.stderr.write(f"[jm] PNG 保存失败 (scale={scale}): {exc}\n")
        if target is not canvas:
            target.close()

    # 仍超限则返回体积最小的 PNG（优先保证可下载）
    if output_png.exists():
        sys.stderr.write(
            f"[jm] 长图 PNG 超过 {max_bytes // (1024 * 1024)}MB，仍输出原文件\n",
        )
        return str(output_png)

    emit_error(f"保存长图失败: {last_error or '未知错误'}")


def stitch_pages_to_longimg(image_paths: list[Path], job_dir: Path) -> str:
    """逐页读取并竖向拼接，输出单张 longimg（JPG 或 PNG）。"""
    configure_pillow()
    from PIL import Image

    if not image_paths:
        emit_error("未找到可拼接的分张图片")

    resample = getattr(getattr(Image, "Resampling", Image), "LANCZOS", Image.LANCZOS)

    # 第一遍：计算统一宽度与总高度
    target_width = 0
    total_height = 0
    page_sizes: list[tuple[int, int]] = []

    for path in image_paths:
        with Image.open(path) as img:
            w, h = img.size
            target_width = max(target_width, w)
            page_sizes.append((w, h))

    for w, h in page_sizes:
        if w != target_width:
            h = max(1, int(h * target_width / w))
        total_height += h

    pixel_count = target_width * total_height
    max_pixels_raw = os.environ.get("JM_LONGIMG_MAX_PIXELS", "none").strip().lower()
    if max_pixels_raw not in ("none", "0", "unlimited", ""):
        limit = int(max_pixels_raw)
        if pixel_count > limit:
            emit_error(
                f"拼接后长图像素 {pixel_count} 超过限制 {limit}，"
                "请调高 JM_LONGIMG_MAX_PIXELS 或降低 JM_MAX_PAGES"
            )

    canvas = Image.new("RGB", (target_width, total_height), (255, 255, 255))
    y = 0

    # 第二遍：逐页粘贴，降低内存占用
    for path, (w, h) in zip(image_paths, page_sizes):
        with Image.open(path) as img:
            page = img.convert("RGB")
            if w != target_width:
                new_h = max(1, int(h * target_width / w))
                page = page.resize((target_width, new_h), resample)
            canvas.paste(page, (0, y))
            y += page.height
            page.close()

    try:
        return save_canvas_as_longimg(canvas, job_dir, resample)
    finally:
        canvas.close()


def finalize_single_longimg(source_path: Path, job_dir: Path) -> str:
    """将已有 PNG 转为 longimg.jpg（备用）。"""
    configure_pillow()
    from PIL import Image

    max_bytes = int(os.environ.get("JM_LONGIMG_MAX_BYTES", str(50 * 1024 * 1024)))
    quality_start = int(os.environ.get("JM_LONGIMG_JPEG_QUALITY", "90"))
    output = job_dir / "longimg.jpg"

    resample = getattr(getattr(Image, "Resampling", Image), "LANCZOS", Image.LANCZOS)
    img = Image.open(source_path).convert("RGB")

    qualities: list[int] = []
    q = quality_start
    while q >= 55:
        qualities.append(q)
        q -= 5

    try:
        for scale in (1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6):
            w, h = img.size
            target = img if scale >= 0.999 else img.resize(
                (max(1, int(w * scale)), max(1, int(h * scale))),
                resample,
            )
            for quality in qualities:
                target.save(output, format="JPEG", quality=quality, optimize=True)
                if output.stat().st_size <= max_bytes:
                    return str(output)

        emit_error(
            f"长图压缩后仍超过 {max_bytes // (1024 * 1024)}MB，"
            "请调高 JM_LONGIMG_MAX_BYTES 或降低 JM_MAX_PAGES"
        )
    finally:
        img.close()
        if source_path != output and source_path.exists():
            source_path.unlink(missing_ok=True)

    return str(output)


def delete_files(paths: list[Path]) -> None:
    for path in paths:
        try:
            if path.is_file():
                path.unlink()
        except OSError:
            pass


def cleanup_empty_dirs(root: Path) -> None:
    if not root.exists():
        return
    for dirpath, dirnames, filenames in os.walk(root, topdown=False):
        current = Path(dirpath)
        if current == root:
            continue
        if not any(current.iterdir()):
            try:
                current.rmdir()
            except OSError:
                pass


def build_longimg_from_pages(
    option_path: str,
    option,
    album_id: str,
    job_dir: Path,
) -> str:
    base_dir = resolve_download_base(option_path, option)
    page_images = collect_album_page_images(base_dir, album_id)

    if not page_images:
        emit_error(f"下载完成但未在 {base_dir} 找到本子 {album_id} 的分张图片")

    longimg_path = stitch_pages_to_longimg(page_images, job_dir)

    delete_files(page_images)
    cleanup_empty_dirs(base_dir)

    for leftover in job_dir.glob("longimg-*.*"):
        if leftover.name not in ("longimg.jpg", "longimg.png"):
            leftover.unlink(missing_ok=True)

    return longimg_path


def resolve_page_count(album, client) -> int:
    page_count = int(getattr(album, "page_count", 0) or 0)
    if page_count > 0:
        return page_count

    total = 0
    for episode in getattr(album, "episode_list", []) or []:
        photo_id = episode[0]
        try:
            photo = client.get_photo_detail(photo_id)
            total += len(photo)
        except Exception:
            continue
    return total


def main() -> None:
    if len(sys.argv) < 4:
        emit_error("用法: jm_export.py <job_dir> <album_id> <option_path> [max_pages]")

    job_dir = Path(sys.argv[1]).resolve()
    album_id = sys.argv[2].strip()
    option_path = sys.argv[3]
    max_pages = int(sys.argv[4]) if len(sys.argv) > 4 else 200

    if not album_id.isdigit():
        emit_error(f"无效本子号码: {album_id}")

    job_dir.mkdir(parents=True, exist_ok=True)

    sys.stdout = _StdoutToStderr()
    try:
        from jmcomic import Feature, create_option_by_file, download_album
    except ImportError:
        emit_error("未安装 jmcomic，请执行: pip install jmcomic -U")

    try:
        option = create_option_by_file(option_path)
        client = option.new_jm_client()
        album = client.get_album_detail(album_id)
    except Exception as exc:
        emit_error(f"查询本子失败: {exc}")

    page_count = resolve_page_count(album, client)
    title = str(getattr(album, "name", "") or getattr(album, "title", "") or "")

    if page_count > max_pages:
        emit_error(
            f"本子页数 {page_count} 超过限制 {max_pages}，请联系管理员调高 JM_MAX_PAGES"
        )

    # 仅导出 PDF；长图由本脚本自行拼接
    extra = Feature.export_pdf(
        pdf_dir=str(job_dir),
        filename_rule="Aid",
        delete_original_file=True,
    )

    try:
        download_album(album_id, option, extra=extra)
    except Exception as exc:
        emit_error(f"下载导出失败: {exc}")
    finally:
        sys.stdout = _REAL_STDOUT

    pdf_path = find_first_file(job_dir, ".pdf")
    longimg_path = build_longimg_from_pages(option_path, option, album_id, job_dir)

    if not pdf_path and not longimg_path:
        emit_error("导出文件不完整")

    print(
        json.dumps(
            {
                "ok": True,
                "albumId": album_id,
                "title": title,
                "pageCount": page_count,
                "pdf": pdf_path,
                "longImg": longimg_path,
                "longImgs": [longimg_path],
            },
            ensure_ascii=False,
        ),
        flush=True,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        traceback.print_exc(file=sys.stderr)
        emit_error(str(exc))
