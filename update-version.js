#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 获取当前版本
function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  return packageJson.version;
}

// 更新package.json
function updatePackageJson(newVersion) {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ Updated package.json to version ${newVersion}`);
}

// 更新package-lock.json
function updatePackageLockJson(newVersion) {
  const packageLockJsonPath = path.join(process.cwd(), 'package-lock.json');
  const packageLockJson = JSON.parse(fs.readFileSync(packageLockJsonPath, 'utf8'));
  packageLockJson.version = newVersion;
  packageLockJson.packages[''].version = newVersion;
  fs.writeFileSync(packageLockJsonPath, JSON.stringify(packageLockJson, null, 2) + '\n');
  console.log(`✅ Updated package-lock.json to version ${newVersion}`);
}

// 执行Git操作
function runGitOperations(newVersion) {
  try {
    // git add .
    console.log('📝 Adding files to git...');
    execSync('git add .', { stdio: 'inherit' });

    // git commit
    const commitMessage = `version ${newVersion}`;
    console.log(`📝 Committing with message: "${commitMessage}"`);
    execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });

    // git tag (如果已存在则删除后重新创建)
    const tagName = `v${newVersion}`;
    console.log(`🏷️  Creating tag: ${tagName}`);

    try {
      // 先尝试删除已存在的tag
      try {
        execSync(`git tag -d ${tagName}`, { stdio: 'pipe' });
        console.log(`🗑️  Deleted existing tag ${tagName}`);
      } catch (deleteError) {
        // 如果删除失败，可能是tag不存在，继续创建
      }

      // 创建新tag
      execSync(`git tag ${tagName}`, { stdio: 'inherit' });
      console.log(`✅ Tag ${tagName} created successfully!`);
    } catch (tagError) {
      console.error('❌ Failed to create tag:', tagError.message);
      throw tagError;
    }

    // git push origin
    console.log('📤 Pushing to origin...');
    execSync('git push origin', { stdio: 'inherit' });

    // git push tags
    console.log('📤 Pushing tags to origin...');
    execSync('git push origin --tags', { stdio: 'inherit' });

    console.log('✅ Git operations completed successfully!');
  } catch (error) {
    console.error('❌ Git operation failed:', error.message);
    process.exit(1);
  }
}

// 主函数
function main() {
  try {
    const currentVersion = getCurrentVersion();
    console.log(`📦 Current version: ${currentVersion}`);

    // 让用户输入新版本号
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`Enter new version (current: ${currentVersion}): `, (newVersion) => {
      // 验证版本号格式
      if (!newVersion || newVersion.trim() === '') {
        console.log('❌ Version cannot be empty.');
        rl.close();
        return;
      }

      newVersion = newVersion.trim();

      // 简单的版本号格式验证
      const versionRegex = /^\d+\.\d+\.\d+(\.\d+)?$/;
      if (!versionRegex.test(newVersion)) {
        console.log('❌ Invalid version format. Please use format like: 1.6.11.6');
        rl.close();
        return;
      }

      console.log(`🔄 New version: ${newVersion}`);

      rl.question(`Do you want to update to version ${newVersion}? (y/N): `, (answer) => {
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          // 更新文件
          updatePackageJson(newVersion);
          updatePackageLockJson(newVersion);

          // Git操作
          runGitOperations(newVersion);

          console.log(`🎉 Version update to ${newVersion} completed successfully!`);
        } else {
          console.log('❌ Version update cancelled.');
        }
        rl.close();
      });
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();