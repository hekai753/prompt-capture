# GitHub Wiki 草稿

这个目录保存 GitHub Wiki 页面源稿。

## 页面

- [使用指南](./使用指南.md)

## 发布到 GitHub Wiki

GitHub Wiki 是独立仓库，地址通常是：

```bash
git clone https://github.com/hekai753/prompt-capture.wiki.git
```

复制页面：

```bash
cp docs/wiki/使用指南.md prompt-capture.wiki/使用指南.md
```

提交并推送：

```bash
cd prompt-capture.wiki
git add 使用指南.md
git commit -m "Add usage guide"
git push
```

如果还没有开启 Wiki，需要先在 GitHub 仓库页面的 Settings 中启用 Wiki。
