#!/usr/bin/env python3
"""
Version Update Tool

用于更新项目版本号并自动执行Git操作的Python脚本。

依赖:
    pip install rich

使用方法:
    python update-version.py

功能:
    - 自动读取当前版本号
    - 验证版本号格式 (x.y.z 或 x.y.z.w)
    - 更新 package.json 和 package-lock.json
    - 执行Git操作 (add, commit, tag, push)
    - 美化的终端界面

GitHub: https://github.com/SchneeHertz/exhentai-manga-manager
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

try:
    from rich.console import Console
    from rich.prompt import Prompt, Confirm
    from rich.panel import Panel
    from rich.text import Text
    from rich.table import Table
    from rich.progress import Progress, SpinnerColumn, TextColumn
except ImportError:
    print("❌ Rich library not found. Please install it with: pip install rich")
    sys.exit(1)

console = Console()

def get_current_version():
    """获取当前版本"""
    try:
        with open('package.json', 'r', encoding='utf-8') as f:
            package_json = json.load(f)
        return package_json.get('version', '0.0.0')
    except (FileNotFoundError, json.JSONDecodeError) as e:
        console.print(f"[red]❌ Error reading package.json: {e}[/red]")
        sys.exit(1)

def update_package_json(new_version):
    """更新package.json"""
    try:
        package_json_path = Path('package.json')
        with open(package_json_path, 'r', encoding='utf-8') as f:
            package_json = json.load(f)

        package_json['version'] = new_version

        with open(package_json_path, 'w', encoding='utf-8') as f:
            json.dump(package_json, f, indent=2, ensure_ascii=False)
            f.write('\n')

        console.print(f"[green]✅ Updated package.json to version {new_version}[/green]")
        return True
    except Exception as e:
        console.print(f"[red]❌ Failed to update package.json: {e}[/red]")
        return False

def update_package_lock_json(new_version):
    """更新package-lock.json或yarn.lock（如果存在）"""
    # 首先尝试package-lock.json
    package_lock_path = Path('package-lock.json')
    if package_lock_path.exists():
        try:
            with open(package_lock_path, 'r', encoding='utf-8') as f:
                package_lock = json.load(f)

            package_lock['version'] = new_version
            if 'packages' in package_lock and '' in package_lock['packages']:
                package_lock['packages']['']['version'] = new_version

            with open(package_lock_path, 'w', encoding='utf-8') as f:
                json.dump(package_lock, f, indent=2, ensure_ascii=False)
                f.write('\n')

            console.print(f"[green]✅ Updated package-lock.json to version {new_version}[/green]")
            return True
        except Exception as e:
            console.print(f"[red]❌ Failed to update package-lock.json: {e}[/red]")
            return False

    # 如果没有package-lock.json，尝试yarn.lock
    yarn_lock_path = Path('yarn.lock')
    if yarn_lock_path.exists():
        try:
            # yarn.lock是纯文本格式，不是JSON
            with open(yarn_lock_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # 简单的版本替换（这不是完美的，但对于基本情况应该够用）
            # 在实际项目中，可能需要更复杂的解析
            import re
            old_version_pattern = r'("?)version("?:\s*)"[^"]*"'
            new_content = re.sub(
                old_version_pattern,
                f'\\1version\\2"{new_version}"',
                content,
                flags=re.MULTILINE
            )

            with open(yarn_lock_path, 'w', encoding='utf-8') as f:
                f.write(new_content)

            console.print(f"[green]✅ Updated yarn.lock to version {new_version}[/green]")
            return True
        except Exception as e:
            console.print(f"[red]❌ Failed to update yarn.lock: {e}[/red]")
            return False

    console.print("[yellow]⚠️  Neither package-lock.json nor yarn.lock found, skipping...[/yellow]")
    return True

def run_git_command(command, description):
    """执行Git命令"""
    try:
        with console.status(f"[bold green]{description}...[/bold green]"):
            result = subprocess.run(
                command,
                check=True,
                capture_output=True,
                text=True,
                encoding='utf-8'
            )
        return True, result.stdout.strip()
    except subprocess.CalledProcessError as e:
        return False, e.stderr.strip()
    except FileNotFoundError:
        return False, "Git command not found. Please ensure Git is installed and in PATH."
    except Exception as e:
        return False, str(e)

def run_git_operations(new_version):
    """执行Git操作"""
    operations = [
        (["git", "add", "."], "📝 Adding files to git"),
        (["git", "commit", "-m", f"version {new_version}"], f"📝 Committing with message: 'version {new_version}'"),
        (["git", "tag", "-d", f"v{new_version}"], f"🗑️  Deleting existing tag v{new_version}"),
        (["git", "tag", f"v{new_version}"], f"🏷️  Creating tag v{new_version}"),
        (["git", "push", "origin"], "📤 Pushing to origin"),
        (["git", "push", "origin", "--tags"], "📤 Pushing tags to origin"),
    ]

    for command, description in operations:
        console.print(f"[bold blue]{description}[/bold blue]")
        success, output = run_git_command(command, description)

        if not success:
            # 对于删除tag失败（tag不存在），这是正常的
            if "tag -d" in command and ("not found" in output or "does not exist" in output):
                console.print("[yellow]⚠️  Tag didn't exist, continuing...[/yellow]")
                continue
            else:
                console.print(f"[red]❌ {description} failed: {output}[/red]")
                console.print("[yellow]⚠️  Git operations incomplete. You may need to complete them manually.[/yellow]")
                return False

        if success and "tag" in command and "Creating tag" in description:
            console.print(f"[green]✅ Tag v{new_version} created successfully![/green]")

    console.print("[green]✅ Git operations completed successfully![/green]")
    return True

def validate_version(version):
    """验证版本号格式"""
    version_pattern = r'^\d+\.\d+\.\d+(\.\d+)?$'
    return bool(re.match(version_pattern, version))

def main():
    """主函数"""
    # 显示标题
    title = Text("Version Update Tool", style="bold magenta")
    panel = Panel(title, border_style="blue", padding=(1, 2))
    console.print(panel)

    # 获取当前版本
    current_version = get_current_version()
    console.print(f"[cyan]📦 Current version: {current_version}[/cyan]")

    # 获取新版本号
    while True:
        new_version = Prompt.ask("Enter new version", default=current_version)

        if not new_version or new_version.strip() == '':
            console.print("[red]❌ Version cannot be empty.[/red]")
            continue

        new_version = new_version.strip()

        if not validate_version(new_version):
            console.print("[red]❌ Invalid version format. Please use format like: 1.6.11.6[/red]")
            continue

        break

    console.print(f"[cyan]🔄 New version: {new_version}[/cyan]")

    # 确认更新
    if not Confirm.ask(f"Do you want to update to version {new_version}?"):
        console.print("[yellow]❌ Version update cancelled.[/yellow]")
        return

    # 显示进度
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        # 更新文件
        task1 = progress.add_task("Updating package files...", total=2)

        if update_package_json(new_version):
            progress.update(task1, advance=1)

        if update_package_lock_json(new_version):
            progress.update(task1, advance=1)

        # Git操作
        task2 = progress.add_task("Running git operations...", total=1)
        if run_git_operations(new_version):
            progress.update(task2, advance=1)

    console.print(f"[green]🎉 Version update to {new_version} completed successfully![/green]")

if __name__ == "__main__":
    main()