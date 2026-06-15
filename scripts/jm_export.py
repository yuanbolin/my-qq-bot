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
    """将 PNG 长图转为 JPEG 并切片，适配 QQ 群聊约 10MB/张、单边 ≤32767 像素限制。"""
    # 留余量，避免边界触发 850031
    max_bytes = 9 * 1024 * 1024
    max_height = 30_000

    try:
        from PIL import Image
    except ImportError:
        return [png_path]

    img = Image.open(png_path).convert("RGB")
    width, height = img.size

    # 宽度过大时先等比缩小，降低单张体积
    if width > 1600:
        scale = 1600 / width
        resample = getattr(Image, 'Resampling', Image).LANCZOS
        img = img.resize((1600, max(1, int(height * scale))), resample)
        width, height = img.size

    pending: list = [img]
    result_paths: list[str] = []
    part_index = 0

    while pending:
        region = pending.pop(0)
        w, h = region.size

        if h > max_height:
            mid = h // 2
            pending.insert(0, region.crop((0, mid, w, h)))
            pending.insert(0, region.crop((0, 0, w, mid)))
            continue

        part_index += 1
        part_path = job_dir / f"longimg-{part_index}.jpg"
        saved = False

        for quality in (80, 70, 60, 50, 40, 30):
            region.save(part_path, format="JPEG", quality=quality, optimize=True)
            if part_path.stat().st_size <= max_bytes:
                result_paths.append(str(part_path))
                saved = True
                break

        if saved:
            continue

        if h <= 200:
            emit_error("长图过大，压缩后仍超过 QQ 上传限制（10MB），请私聊获取 PDF")

        mid = h // 2
        pending.insert(0, region.crop((0, mid, w, h)))
        pending.insert(0, region.crop((0, 0, w, mid)))
        part_index -= 1

    return result_paths


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
