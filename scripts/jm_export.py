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


def stitch_page_images(image_paths: list[Path], output_png: Path) -> None:
    """将分张竖向拼接为一张长图。"""
    from PIL import Image

    if not image_paths:
        emit_error("未找到可拼接的分张图片")

    resample = getattr(getattr(Image, "Resampling", Image), "LANCZOS", Image.LANCZOS)
    opened = [Image.open(p).convert("RGB") for p in image_paths]

    try:
        target_width = max(img.width for img in opened)
        normalized = []
        for img in opened:
            if img.width != target_width:
                new_h = max(1, int(img.height * target_width / img.width))
                img = img.resize((target_width, new_h), resample)
            normalized.append(img)

        total_height = sum(img.height for img in normalized)
        canvas = Image.new("RGB", (target_width, total_height), (255, 255, 255))

        y = 0
        for img in normalized:
            canvas.paste(img, (0, y))
            y += img.height

        output_png.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(output_png, format="PNG")
    finally:
        for img in opened:
            img.close()


def finalize_single_longimg(source_path: Path, job_dir: Path) -> str:
    """输出单张 longimg.jpg，整图压缩但不切分。"""
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

    temp_png = job_dir / "_stitched.png"
    stitch_page_images(page_images, temp_png)

    longimg_path = finalize_single_longimg(temp_png, job_dir)

    delete_files(page_images)
    cleanup_empty_dirs(base_dir)

    for leftover in job_dir.glob("longimg-*.jpg"):
        if leftover.name != "longimg.jpg":
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
