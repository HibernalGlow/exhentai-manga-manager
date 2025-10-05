#!/usr/bin/env python3
"""
Database Cleanup Script for ExHentai Manga Manager
用于清理ExHentai漫画管理器数据库的脚本

通过对比文件名和日文标题的相似度来识别和删除不匹配的记录
支持 .db 和 .sqlite 文件格式
"""

import sqlite3
import os
import sys
import re
from typing import List, Tuple
import argparse


from rich.table import Table
from rich.panel import Panel
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.prompt import Confirm
RICH_AVAILABLE = True
console = Console()


def create_record_table(records: List[Tuple], start_idx: int = 0, limit: int = 10) -> Table:
    """创建记录表格"""
    if not RICH_AVAILABLE:
        return None

    table = Table(title=f"可疑记录列表 (显示 {start_idx+1}-{min(start_idx+limit, len(records))})")
    table.add_column("序号", style="cyan", no_wrap=True)
    table.add_column("GID", style="magenta")
    table.add_column("相似度", style="red")
    table.add_column("英文标题", style="yellow", max_width=30)
    table.add_column("日文标题", style="green", max_width=30)
    table.add_column("提取文件名", style="blue", max_width=25)
    table.add_column("文件数", style="white")
    table.add_column("大小", style="white")

    for i, record in enumerate(records[start_idx:start_idx+limit], start_idx+1):
        gid, token, title, title_jpn, filename_title, similarity, filecount, filesize, posted = record

        # 格式化文件大小
        if filesize:
            size_mb = filesize / 1024 / 1024
            size_str = f"{size_mb:.1f}MB"
        else:
            size_str = "未知"

        # 相似度颜色
        if similarity < 0.2:
            sim_style = "red bold"
        elif similarity < 0.3:
            sim_style = "yellow"
        else:
            sim_style = "green"

        table.add_row(
            str(i),
            str(gid),
            f"{similarity:.3f}",
            title or "无",
            title_jpn or "无",
            filename_title or "无",
            str(filecount or 0),
            size_str
        )

    return table

def display_record_detail(record: Tuple) -> None:
    """显示记录详细信息"""
    gid, token, title, title_jpn, filename_title, similarity, filecount, filesize, posted = record

    if RICH_AVAILABLE:
        # 创建详细信息面板
        info = f"""[bold cyan]GID:[/bold cyan] {gid}
[bold cyan]Token:[/bold cyan] {token}
[bold yellow]英文标题:[/bold yellow] {title or '无'}
[bold green]日文标题:[/bold green] {title_jpn or '无'}
[bold blue]提取文件名:[/bold blue] {filename_title or '无'}
[bold red]相似度:[/bold red] {similarity:.3f}
[bold white]文件数:[/bold white] {filecount or 0}
[bold white]文件大小:[/bold white] {filesize and f'{filesize/1024/1024:.1f}MB ({filesize} bytes)' or '未知'}
[bold white]发布时间:[/bold white] {posted and f'20{str(posted)[:2]}-{str(posted)[2:4]}-{str(posted)[4:6]}' or '未知'}"""

        panel = Panel(info, title="📋 记录详细信息", border_style="blue")
        console.print(panel)
    else:
        print(f"\n--- 记录详情 ---")
        print(f"GID: {gid}, Token: {token}")
        print(f"英文标题: {title}")
        print(f"日文标题: {title_jpn}")
        print(f"提取文件名: {filename_title}")
        print(f"相似度: {similarity:.3f}")
        print(f"文件数: {filecount}")
        print(f"文件大小: {filesize and f'{filesize/1024/1024:.1f}MB' or '未知'}")
        print(f"发布时间: {posted and f'20{str(posted)[:2]}-{str(posted)[2:4]}-{str(posted)[4:6]}' or '未知'}")

def get_similarity_color(similarity: float) -> str:
    """获取相似度的颜色"""
    if similarity < 0.2:
        return "red"
    elif similarity < 0.3:
        return "yellow"
    else:
        return "green"

def normalize_string(text: str) -> str:
    """归一化字符串：全角转半角、移除多余空格"""
    if not text:
        return text

    # 全角转半角：ASCII 字符（包括数字、字母、符号）
    text = re.sub(r'[\uFF01-\uFF5E]', lambda m: chr(ord(m.group(0)) - 0xFEE0), text)

    # 全角空格转半角空格
    text = text.replace('\u3000', ' ')

    # 多个连续空格替换为一个空格
    text = re.sub(r'\s+', ' ', text)

    # 去除首尾空格
    return text.strip()

def levenshtein_distance(s1: str, s2: str) -> int:
    """计算编辑距离"""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]

def jaccard_similarity(s1: str, s2: str) -> float:
    """计算Jaccard相似度"""
    if not s1 or not s2:
        return 0.0

    set1 = set(s1.split())
    set2 = set(s2.split())

    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))

    return intersection / union if union > 0 else 0.0

def get_lcs_length(s1: str, s2: str) -> int:
    """计算最长公共子序列长度"""
    m, n = len(s1), len(s2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[i-1] == s2[j-1]:
                dp[i][j] = dp[i-1][j-1] + 1
            else:
                dp[i][j] = max(dp[i-1][j], dp[i][j-1])

    return dp[m][n]

def calculate_similarity(text1: str, text2: str) -> float:
    """计算综合相似度"""
    if not text1 or not text2:
        return 0.0

    s1 = normalize_string(text1).lower()
    s2 = normalize_string(text2).lower()

    if s1 == s2:
        return 1.0

    # LCS相似度
    lcs_len = get_lcs_length(s1, s2)
    lcs_sim = (2.0 * lcs_len) / (len(s1) + len(s2))

    # 编辑距离相似度
    lev_dist = levenshtein_distance(s1, s2)
    lev_sim = 1 - (lev_dist / max(len(s1), len(s2)))

    # Jaccard相似度
    jaccard_sim = jaccard_similarity(s1, s2)

    # 加权组合
    combined_sim = (lcs_sim * 0.4) + (lev_sim * 0.4) + (jaccard_sim * 0.2)

    # 包含关系加分
    if s1 in s2 or s2 in s1:
        containment_bonus = min(len(s1), len(s2)) / max(len(s1), len(s2))
        combined_sim = min(1.0, combined_sim + containment_bonus * 0.15)

    # 长度差异惩罚
    length_ratio = min(len(s1), len(s2)) / max(len(s1), len(s2))
    if length_ratio < 0.5:
        combined_sim *= 0.8

    return max(0.0, min(1.0, combined_sim))

def extract_filename_title(filename: str) -> str:
    """从文件名中提取标题部分"""
    if not filename:
        return ""

    # 移除文件扩展名
    filename = os.path.splitext(filename)[0]

    # 移除常见的标识符
    patterns_to_remove = [
        r'\[.*?\]',  # [tag]
        r'\(.*?\)',  # (tag)
        r'\{.*?\}',  # {tag}
        r'【.*?】',   # 【tag】
        r'《.*?》',   # 《tag》
        r'\d{4,}',   # 年份
        r'\d+p',     # 分辨率
        r'v\d+',     # 版本
        r'vol\.\d+', # 卷数
        r'ch\.\d+',  # 章节
    ]

    for pattern in patterns_to_remove:
        filename = re.sub(pattern, '', filename, flags=re.IGNORECASE)

    # 清理多余的空格和标点
    filename = re.sub(r'[_\-\.\s]+', ' ', filename)
    filename = re.sub(r'[^\w\s\u4e00-\u9fff]', '', filename)  # 只保留字母、数字、中文

    return normalize_string(filename).strip()

def analyze_database(db_path: str, min_similarity: float = 0.3) -> List[Tuple]:
    """分析数据库中的记录"""
    if not os.path.exists(db_path):
        print(f"❌ 数据库文件不存在: {db_path}", "red")
        return []

    print("🔍 正在连接数据库...", "cyan")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 检查表结构并动态选择要分析的表
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cursor.fetchall()]

    target_table = None
    table_columns = []

    if 'gallery' in tables:
        target_table = 'gallery'
    else:
        # 尝试在其他表中找到包含 title_jpn 或 title 字段的表
        for t in tables:
            try:
                cursor.execute(f"PRAGMA table_info({t})")
                cols = [c[1] for c in cursor.fetchall()]
            except Exception:
                cols = []

            if 'title_jpn' in cols or 'title' in cols:
                target_table = t
                table_columns = cols
                break

    # 获取目标表的列信息（如果是 gallery，获取其列）
    if target_table == 'gallery' and 'gallery' in tables:
        cursor.execute("PRAGMA table_info(gallery)")
        table_columns = [c[1] for c in cursor.fetchall()]

    if not target_table:
        print("❌ 未找到包含 'title' 或 'title_jpn' 字段的表，无法分析。可尝试指定正确的 metadata.sqlite 文件。")
        conn.close()
        return []

    # 根据目标表的可用列构建查询
    exprs = []

    # gid: 优先使用真实 gid，否则使用 rowid 作为后备
    if 'gid' in table_columns:
        exprs.append('gid')
    else:
        exprs.append('rowid AS gid')

    # token: 优先 token，其次尝试 hash 或 key
    if 'token' in table_columns:
        exprs.append('token')
    elif 'hash' in table_columns:
        exprs.append('hash AS token')
    elif 'key' in table_columns:
        exprs.append('key AS token')
    else:
        exprs.append('NULL AS token')

    # 其余列按需回退为 NULL
    for col in ['title', 'title_jpn', 'filecount', 'filesize', 'posted']:
        if col in table_columns:
            exprs.append(col)
        else:
            exprs.append(f'NULL AS {col}')

    select_expr = ', '.join(exprs)

    # 构建 WHERE 子句：优先使用 title_jpn，其次使用 title，如果都没有则不过滤
    if 'title_jpn' in table_columns:
        where_clause = "WHERE title_jpn IS NOT NULL AND title_jpn != ''"
    elif 'title' in table_columns:
        where_clause = "WHERE title IS NOT NULL AND title != ''"
    else:
        where_clause = ''

    # 获取总记录数（基于 where_clause）
    try:
        if where_clause:
            cursor.execute(f"SELECT COUNT(*) FROM {target_table} {where_clause}")
        else:
            cursor.execute(f"SELECT COUNT(*) FROM {target_table}")
        total_records = cursor.fetchone()[0]
    except Exception:
        total_records = 0

    print(f"📊 找到 {total_records} 条待分析的记录 (表: {target_table})")

    # 获取所有记录
    order_clause = 'ORDER BY posted DESC' if 'posted' in table_columns else ''
    sql = f"SELECT {select_expr} FROM {target_table} {where_clause} {order_clause}"
    cursor.execute(sql)

    results = []
    processed = 0

    if RICH_AVAILABLE:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            console=console
        ) as progress:
            task = progress.add_task("分析记录中...", total=total_records)

            for row in cursor.fetchall():
                gid, token, title, title_jpn, filecount, filesize, posted = row

                # 从日文标题中提取文件名
                filename_title = extract_filename_title(title_jpn or title or "")

                # 计算相似度：在可用的 title 候选中取最大值（title, title_jpn）
                title_candidates = [title, title_jpn]
                sims = [calculate_similarity(filename_title, (c or "")) for c in title_candidates if c]
                similarity = max(sims) if sims else 0.0

                if similarity < min_similarity:
                    results.append((gid, token, title, title_jpn, filename_title, similarity, filecount, filesize, posted))

                processed += 1
                progress.update(task, advance=1, description=f"已处理 {processed}/{total_records} 条记录")
    else:
        print("开始分析记录...")
        for row in cursor.fetchall():
            gid, token, title, title_jpn, filecount, filesize, posted = row

            # 从日文标题中提取文件名
            filename_title = extract_filename_title(title_jpn or title or "")

            # 计算相似度：在可用的 title 候选中取最大值（title, title_jpn）
            title_candidates = [title, title_jpn]
            sims = [calculate_similarity(filename_title, (c or "")) for c in title_candidates if c]
            similarity = max(sims) if sims else 0.0

            if similarity < min_similarity:
                results.append((gid, token, title, title_jpn, filename_title, similarity, filecount, filesize, posted))

            processed += 1
            if processed % 100 == 0:
                print(f"已处理 {processed}/{total_records} 条记录...")

    conn.close()

    print(f"✅ 分析完成！找到 {len(results)} 条可疑记录（相似度 < {min_similarity}）", "green")
    return results

def display_record(record: Tuple, index: int) -> None:
    """显示记录信息"""
    gid, token, title, title_jpn, filename_title, similarity, filecount, filesize, posted = record

    print(f"\n--- 记录 {index} ---")
    print(f"GID: {gid}, Token: {token}")
    print(f"英文标题: {title}")
    print(f"日文标题: {title_jpn}")
    print(f"提取的文件名: {filename_title}")
    print(f"相似度: {similarity:.3f}")
    print(f"文件数: {filecount}")
    print(f"文件大小: {filesize} bytes ({filesize/1024/1024:.1f} MB)" if filesize else "文件大小: 未知")
    print(f"发布时间: {posted} ({posted and '20' + str(posted)[:2] + '-' + str(posted)[2:4] + '-' + str(posted)[4:6] or '未知'})")

def delete_record(db_path: str, gid: int, token: str) -> bool:
    """删除指定的记录"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute("DELETE FROM gallery WHERE gid = ? AND token = ?", (gid, token))
        conn.commit()
        deleted = cursor.rowcount > 0
        if deleted:
            print(f"成功删除记录: GID={gid}, Token={token}")
        else:
            print(f"未找到要删除的记录: GID={gid}, Token={token}")
        return deleted
    except Exception as e:
        print(f"删除记录时出错: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

def interactive_cleanup(db_path: str, min_similarity: float = 0.3) -> None:
    """交互式清理"""
    print("🚀 开始分析数据库...", "bold cyan")
    records = analyze_database(db_path, min_similarity)

    if not records:
        print(f"🎉 没有找到相似度低于 {min_similarity} 的记录，数据库很干净！", "green")
        return

    print(f"\n📋 共找到 {len(records)} 条可疑记录", "yellow")

    # 显示统计信息
    if RICH_AVAILABLE:
        # 按相似度分组统计
        low_sim = sum(1 for r in records if r[5] < 0.2)
        medium_sim = sum(1 for r in records if 0.2 <= r[5] < 0.3)
        high_sim = len(records) - low_sim - medium_sim

        stats_table = Table(title="相似度分布统计")
        stats_table.add_column("相似度范围", style="cyan")
        stats_table.add_column("数量", style="magenta")
        stats_table.add_column("占比", style="green")

        total = len(records)
        stats_table.add_row("< 0.2", str(low_sim), f"{low_sim/total*100:.1f}%")
        stats_table.add_row("0.2-0.3", str(medium_sim), f"{medium_sim/total*100:.1f}%")
        stats_table.add_row("总计", str(total), "100%")

        console.print(stats_table)

    deleted_count = 0
    kept_count = 0
    current_page = 0
    page_size = 5

    while current_page * page_size < len(records):
        start_idx = current_page * page_size
        end_idx = min(start_idx + page_size, len(records))
        current_records = records[start_idx:end_idx]

        # 显示当前页的表格
        if RICH_AVAILABLE:
            table = create_record_table(records, start_idx, page_size)
            if table:
                console.print(table)

        # 处理当前页的记录
        for i, record in enumerate(current_records, start_idx + 1):
            display_record_detail(record)

            if RICH_AVAILABLE:
                # 使用rich的确认提示
                should_delete = Confirm.ask(f"\n❓ 是否删除这条记录 (GID: {record[0]})?", default=False)
            else:
                while True:
                    choice = input(f"\n是否删除这条记录 (GID: {record[0]})? (y/n): ").lower().strip()
                    if choice in ['y', 'yes']:
                        should_delete = True
                        break
                    elif choice in ['n', 'no']:
                        should_delete = False
                        break
                    else:
                        print("请输入 y 或 n")

            if should_delete:
                gid, token = record[0], record[1]
                if delete_record(db_path, gid, token):
                    deleted_count += 1
                    print("✅ 记录已删除", "green")
                else:
                    print("❌ 删除失败", "red")
            else:
                kept_count += 1
                print("⏭️ 记录已保留", "blue")

        # 检查是否还有更多记录
        remaining = len(records) - end_idx
        if remaining > 0:
            if RICH_AVAILABLE:
                continue_processing = Confirm.ask(f"\n📄 还有 {remaining} 条记录，是否继续处理?", default=True)
            else:
                choice = input(f"\n还有 {remaining} 条记录，是否继续? (y/n): ").lower().strip()
                continue_processing = choice in ['y', 'yes']

            if not continue_processing:
                print("🛑 用户取消操作", "yellow")
                break

        current_page += 1

    # 显示最终统计
    if RICH_AVAILABLE:
        final_stats = Table(title="清理结果统计")
        final_stats.add_column("操作", style="cyan")
        final_stats.add_column("数量", style="magenta")

        final_stats.add_row("已删除", str(deleted_count))
        final_stats.add_row("已保留", str(kept_count))
        final_stats.add_row("总处理", str(deleted_count + kept_count))

        console.print(final_stats)
    else:
        print(f"\n清理完成！删除: {deleted_count}, 保留: {kept_count}")

    print(f"\n🎊 数据库清理完成！共处理 {deleted_count + kept_count} 条记录", "bold green")

def main():
    if RICH_AVAILABLE:
        # 显示欢迎信息
        welcome = Panel(
            "[bold cyan]ExHentai Manga Manager[/bold cyan]\n"
            "[yellow]数据库清理工具[/yellow]\n\n"
            "🔍 智能分析可疑记录\n"
            "📊 详细的相似度报告\n"
            "🎯 安全的交互式删除",
            title="🚀 欢迎使用",
            border_style="blue"
        )
        console.print(welcome)

    parser = argparse.ArgumentParser(
        description="ExHentai数据库清理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  python database_cleanup.py data.db                    # 交互式清理
  python database_cleanup.py data.db --analyze-only     # 仅分析
  python database_cleanup.py data.db --min-similarity 0.2  # 自定义阈值
        """
    )
    parser.add_argument("db_path", help="SQLite数据库文件路径")
    parser.add_argument("--min-similarity", type=float, default=0.3,
                       help="最小相似度阈值 (默认: 0.3)")
    parser.add_argument("--analyze-only", action="store_true",
                       help="仅分析，不进行交互式删除")

    # 支持两种启动方式：
    # 1) 通过命令行参数启动（保持 argparse 行为）
    # 2) 无参数启动时进入交互式提示，询问 db_path, min_similarity, analyze_only

    # 如果脚本以命令行参数运行
    if len(sys.argv) > 1:
        args = parser.parse_args()

        if not os.path.exists(args.db_path):
            print(f"❌ 数据库文件不存在: {args.db_path}")
            sys.exit(1)

        if args.analyze_only:
            print("🔍 开始分析数据库...")
            records = analyze_database(args.db_path, args.min_similarity)

            if records and RICH_AVAILABLE:
                # 显示分析结果表格
                table = create_record_table(records, 0, min(20, len(records)))
                if table:
                    console.print(table)

                if len(records) > 20:
                    print(f"💡 还有 {len(records) - 20} 条记录未显示，使用交互模式查看全部")

            print(f"\n📊 分析完成！找到 {len(records)} 条可疑记录")
        else:
            interactive_cleanup(args.db_path, args.min_similarity)

    else:
        # 无参数交互模式
        # 默认路径（按用户要求）
        default_db = r"C:\Users\30902\AppData\Roaming\exhentai-manga-manager\metadata.sqlite"
        print(f"交互模式：请按提示输入（回车使用默认: {default_db}）")

        # 询问数据库路径，回车使用默认
        while True:
            db_input = input("请输入SQLite数据库文件路径 (.db 或 .sqlite): ").strip()
            if not db_input:
                db_input = default_db

            if not os.path.exists(db_input):
                print(f"文件不存在: {db_input}")
                retry = input("是否重新输入路径? (y/n): ").strip().lower()
                if retry in ('y', 'yes'):
                    continue
                else:
                    print("退出")
                    return
            break

        # 询问相似度阈值
        while True:
            sim_input = input(f"最小相似度阈值 (默认 0.3): ").strip()
            if not sim_input:
                min_sim = 0.3
                break
            try:
                min_sim = float(sim_input)
                if 0.0 <= min_sim <= 1.0:
                    break
                else:
                    print("请输入 0.0 - 1.0 之间的数值")
            except ValueError:
                print("输入无效，请输入数字，如 0.25")

        # 是否仅分析
        analyze_only_input = input("是否仅分析，不进行删除? (y/N): ").strip().lower()
        analyze_only = analyze_only_input in ('y', 'yes')

        # 运行相应流程
        if analyze_only:
            print("🔍 开始分析数据库...")
            records = analyze_database(db_input, min_sim)
            if records and RICH_AVAILABLE:
                table = create_record_table(records, 0, min(20, len(records)))
                if table:
                    console.print(table)
            print(f"\n📊 分析完成！找到 {len(records)} 条可疑记录")
        else:
            interactive_cleanup(db_input, min_sim)

if __name__ == "__main__":
    main()