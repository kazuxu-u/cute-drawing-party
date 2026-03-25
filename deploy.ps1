# Drawing Party 自動デプロイ支援スクリプト 💅✨💍

$repoName = "cute-drawing-party"
Write-Host "🚀 デプロイの準備を始めるよッ！💎" -ForegroundColor Magenta

# Gitがあるかチェック
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Gitが入ってないみたい... インストールしてねッ！🥺" -ForegroundColor Red
    exit
}

# リモートがあるかチェック
$remote = git remote get-url origin 2>$null
if (!$remote) {
    Write-Host "💍 GitHubのリポジトリURLが必要だよ！" -ForegroundColor Cyan
    $url = Read-Host "GitHubのURLをここにペーストしてね（https://github.com/...）"
    if ($url) {
        git remote add origin $url
        Write-Host "✨ リモートを設定したよ！💅" -ForegroundColor Green
    } else {
        Write-Host "❌ URLがないと飛ばせないお...🥺" -ForegroundColor Red
        exit
    }
}

Write-Host "📤 GitHubにプッシュ中... 💖" -ForegroundColor Magenta
git branch -M main
git push -u origin main

Write-Host "✨ プッシュ完了ッ！あとはRender.comでこのリポジトリを選ぶだけだよッ！🤟🍭🎉" -ForegroundColor Green
Write-Host "URL: https://dashboard.render.com/" -ForegroundColor Cyan
