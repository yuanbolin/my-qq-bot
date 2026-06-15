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
    print(json.dumps({"ok": False, "error": message}, ensure_ascii=False), flush=True)
    sys.exit(code)


def find_first_file(directory: Path, suffix: str) -> str | None:
    files = sorted(directory.glob(f"*{suffix}"))
    if not files:
        files = sorted(directory.rglob(f"*{suffix}"))
    return str(files[0]) if files else None


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

    pdf_path = find_first_file(job_dir, ".pdf")
    long_img_path = find_first_file(job_dir, ".png")

    # 允许部分导出成功：群聊只需长图，私聊只需 PDF
    if not pdf_path and not long_img_path:
        emit_error(
            "导出文件不完整，"
            f"pdf={'有' if pdf_path else '无'}, longImg={'有' if long_img_path else '无'}"
        )

    print(
        json.dumps(
            {
                "ok": True,
                "albumId": album_id,
                "title": title,
                "pageCount": page_count,
                "pdf": pdf_path,
                "longImg": long_img_path,
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
