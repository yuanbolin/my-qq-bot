#!/usr/bin/env python3
"""
JM 本子导出脚本，供 Node bot 子进程调用。
依赖：pip install jmcomic -U
"""
from __future__ import annotations

import json
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


def optimize_long_img_for_qq(png_path: str, job_dir: Path) -> list[str]:
    """将 PNG 长图转为 JPEG 并按大小分片，适配 QQ 上传限制（约 28MB/张）。"""
    max_bytes = 28 * 1024 * 1024

    try:
        from PIL import Image
    except ImportError:
        return [png_path]

    img = Image.open(png_path).convert("RGB")
    width, height = img.size

    def save_jpeg(region, path: Path, quality: int) -> int:
        region.save(path, format="JPEG", quality=quality, optimize=True)
        return path.stat().st_size

    full_jpg = job_dir / "longimg.jpg"
    for quality in (85, 75, 65, 55, 45):
        if save_jpeg(img, full_jpg, quality) <= max_bytes:
            return [str(full_jpg)]

    for part_count in range(2, 11):
        slice_h = (height + part_count - 1) // part_count
        paths: list[str] = []
        ok = True

        for index in range(part_count):
            top = index * slice_h
            if top >= height:
                break
            bottom = min((index + 1) * slice_h, height)
            crop = img.crop((0, top, width, bottom))
            part_path = job_dir / f"longimg-{index + 1}.jpg"
            if save_jpeg(crop, part_path, 75) > max_bytes:
                ok = False
                break
            paths.append(str(part_path))

        if ok and paths:
            return paths

    emit_error("长图过大，压缩后仍超过 QQ 上传限制，请私聊获取 PDF")


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

    page_count = int(getattr(album, "page_count", 0) or 0)
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
    long_img_paths = optimize_long_img_for_qq(long_img_path, job_dir) if long_img_path else []

    # 允许部分导出成功：群聊只需长图，私聊只需 PDF
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
