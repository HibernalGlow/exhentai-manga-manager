#!/usr/bin/env python3
"""
黑名单格式迁移脚本
将旧的黑名单格式（数组）迁移到新的格式（对象，以book.id为键）
从数据库补全文件名和路径信息
"""

import json
import os
import sys
import sqlite3
from pathlib import Path
from datetime import datetime

def migrate_blacklist(blacklist_path, database_path=None):
    """
    迁移黑名单文件格式

    Args:
        blacklist_path: 黑名单文件路径
        database_path: 数据库文件路径，如果不提供则自动查找

    Returns:
        bool: 迁移是否成功
    """
    if not os.path.exists(blacklist_path):
        print(f"黑名单文件不存在: {blacklist_path}")
        return False

    # 如果没有提供数据库路径，自动查找
    if not database_path:
        # 首先尝试与黑名单文件同目录下的database.sqlite
        possible_db_paths = [
            os.path.join(os.path.dirname(blacklist_path), 'database.sqlite'),
            os.path.join(os.path.dirname(blacklist_path), '..', 'database.sqlite'),
            # Windows默认STORE_PATH
            os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', 'exhentai-manga-manager', 'database.sqlite'),
            'database.sqlite'
        ]
        for path in possible_db_paths:
            if os.path.exists(path):
                database_path = path
                break

    if not database_path or not os.path.exists(database_path):
        print("未找到数据库文件，无法补全黑名单信息")
        return False

    print(f"使用数据库文件: {database_path}")

    try:
        # 读取现有黑名单文件
        with open(blacklist_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 检查是否已经是新格式
        if data.get('version') == '2.0' and isinstance(data.get('blacklist'), dict):
            print("黑名单已经是新格式，无需迁移")
            return True

        # 检查是否是旧格式
        if data.get('version') == '1.0' and isinstance(data.get('blacklist'), list):
            print(f"发现旧格式黑名单，包含 {len(data['blacklist'])} 个项目")

            # 连接数据库
            conn = sqlite3.connect(database_path)
            cursor = conn.cursor()

            # 转换为新格式
            new_blacklist = {}
            migrated_count = 0
            skipped_count = 0

            for item in data['blacklist']:
                if isinstance(item, str) and '|' in item:
                    # 解析旧格式 "id|title"
                    parts = item.split('|', 1)
                    if len(parts) == 2:
                        book_id, title = parts

                        # 从数据库查询完整信息
                        cursor.execute('SELECT filepath FROM mangas WHERE id = ?', (book_id,))
                        result = cursor.fetchone()

                        if result:
                            filepath = result[0]
                            filename = os.path.basename(filepath)

                            new_blacklist[book_id] = {
                                'filename': filename,
                                'fullPath': filepath
                            }
                            migrated_count += 1
                            print(f"✅ 迁移: {book_id} -> {filename}")
                        else:
                            print(f"⚠️ 数据库中未找到: {book_id}")
                            # 仍然保留，但信息不完整
                            new_blacklist[book_id] = {
                                'filename': title,  # 使用title作为filename
                                'fullPath': ''
                            }
                            skipped_count += 1
                    else:
                        print(f"⚠️ 无效格式: {item}")
                        skipped_count += 1
                else:
                    print(f"⚠️ 跳过无效项目: {item}")
                    skipped_count += 1

            conn.close()

            # 创建新格式数据
            new_data = {
                'version': '2.0',
                'lastUpdate': datetime.now().isoformat(),
                'blacklist': new_blacklist
            }

            # 备份原文件
            backup_path = f"{blacklist_path}.backup"
            with open(backup_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"已备份原文件到: {backup_path}")

            # 写入新格式
            with open(blacklist_path, 'w', encoding='utf-8') as f:
                json.dump(new_data, f, indent=2, ensure_ascii=False)

            print(f"✅ 迁移完成！成功迁移 {migrated_count} 个项目，跳过 {skipped_count} 个项目")
            print(f"新格式文件大小: {os.path.getsize(blacklist_path)} 字节")
            return True

        else:
            print("未知的黑名单格式，跳过迁移")
            return False

    except Exception as e:
        print(f"迁移失败: {e}")
        return False

def main():
    # 尝试找到黑名单文件路径
    possible_paths = [
        # Windows默认STORE_PATH中的match-blacklist.json
        os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming', 'exhentai-manga-manager', 'match-blacklist.json'),
        # 相对于脚本的路径
        'resources/extraResources/zip_blacklist.json',
        # 绝对路径（根据项目结构）
        os.path.join(os.path.dirname(__file__), 'resources', 'extraResources', 'zip_blacklist.json'),
        # 用户指定的路径
        sys.argv[1] if len(sys.argv) > 1 else None
    ]

    blacklist_path = None
    for path in possible_paths:
        if path and os.path.exists(path):
            blacklist_path = path
            break

    if not blacklist_path:
        print("未找到黑名单文件。请提供正确的路径作为参数。")
        print("用法: python migrate_blacklist.py [黑名单文件路径] [数据库文件路径]")
        sys.exit(1)

    # 获取数据库路径参数
    database_path = sys.argv[2] if len(sys.argv) > 2 else None

    print(f"使用黑名单文件: {blacklist_path}")
    success = migrate_blacklist(blacklist_path, database_path)

    if success:
        print("\n🎉 迁移成功！")
        print("黑名单现在使用book.id作为键，并包含完整的文件名和路径信息。")
    else:
        print("\n❌ 迁移失败！")
        sys.exit(1)

if __name__ == '__main__':
    main()