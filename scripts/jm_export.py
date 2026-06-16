#!/usr/bin/env python3
"""
JM 本子导出脚本，供 Node bot 子进程调用。
依赖：pip install jmcomic -U
"""
from __future__ import annotations

import json
import os
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


def find_first_file(directory: Path, suffix: str) -> str | None:
    files = sorted(directory.glob(f"*{suffix}"))
    if not files:
        files = sorted(directory.rglob(f"*{suffix}"))
    return str(files[0]) if files else None


def compress_long_img_for_download(png_path: str, job_dir: Path) -> list[str]:
    """按高度切分长图后逐片压缩，优先保持原始宽度与较高 JPEG 质量。"""
    max_bytes = int(os.environ.get("JM_LONGIMG_MAX_BYTES", str(9 * 1024 * 1024)))
    strip_height = int(os.environ.get("JM_LONGIMG_STRIP_HEIGHT", "8000"))
    jpeg_quality_start = int(os.environ.get("JM_LONGIMG_JPEG_QUALITY", "92"))

    try:
        from PIL import Image
    except ImportError:
        return [png_path]

    resample = getattr(getattr(Image, "Resampling", Image), "LANCZOS", Image.LANCZOS)
    img = Image.open(png_path).convert("RGB")
    width, height = img.size

    # 先按固定高度切成互不重叠的条带，避免旧逻辑出现重复片段
    strips: list = []
    y = 0
    while y < height:
        h = min(strip_height, height - y)
        strips.append(img.crop((0, y, width, y + h)).copy())
        y += h

    result_paths: list[str] = []

    for index, strip in enumerate(strips, start=1):
        part_path = job_dir / f"longimg-{index}.jpg"
        if _save_strip_jpeg(strip, part_path, max_bytes, jpeg_quality_start, resample):
            result_paths.append(str(part_path))
        else:
            emit_error(f"长图第 {index}/{len(strips)} 片压缩至 9MB 以内失败，请调小 JM_LONGIMG_STRIP_HEIGHT")

    return result_paths


def _save_strip_jpeg(strip, dest: Path, max_bytes: int, quality_start: int, resample) -> bool:
    """保存单条带 JPEG，必要时降低质量或小幅缩小尺寸。"""
    from PIL import Image

    qualities = []
    q = quality_start
    while q >= 60:
        qualities.append(q)
        q -= 5

    for scale in (1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7):
        w, h = strip.size
        target = strip if scale >= 0.999 else strip.resize(
            (max(1, int(w * scale)), max(1, int(h * scale))),
            resample,
        )
        for quality in qualities:
            target.save(dest, format="JPEG", quality=quality, optimize=True)
            if dest.stat().st_size <= max_bytes:
                return True

    return False


def resolve_page_count(album, client) -> int:
    """album.page_count 有时为 0，回退为各章节页数之和。"""
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

    # jmcomic 的 pretty 日志会写入 stdout，需重定向以免 Node 无法解析 JSON
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
            f"本子页数 {page_count} 超过限制 {max_pages}，请私聊获取 PDF 或联系管理员调高 JM_MAX_PAGES"
        )

    extra = (
        Feature.export_pdf(
            pdf_dir=str(job_dir),
            filename_rule="Aid",
            delete_original_file=True,
        )
        + Feature.export_long_img(
            img_dir=str(job_dir),
            filename_rule="Aid",
            delete_original_file=True,
        )
    )

    try:
        download_album(album_id, option, extra=extra)
    except Exception as exc:
        emit_error(f"下载导出失败: {exc}")
    finally:
        sys.stdout = _REAL_STDOUT

    pdf_path = find_first_file(job_dir, ".pdf")
    long_img_path = find_first_file(job_dir, ".png")
    long_img_paths = (
        compress_long_img_for_download(long_img_path, job_dir) if long_img_path else []
    )

    if not pdf_path and not long_img_paths:
        emit_error(
            "导出文件不完整，"
            f"pdf={'有' if pdf_path else '无'}, longImg={'有' if long_img_paths else '无'}"
        )

    print(
        json.dumps(
            {
                "ok": True,
                "albumId": album_id,
                "title": title,
                "pageCount": page_count,
                "pdf": pdf_path,
                "longImg": long_img_paths[0] if long_img_paths else None,
                "longImgs": long_img_paths,
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
