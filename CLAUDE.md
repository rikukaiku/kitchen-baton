# 作業ブランチ・並行編集ルール

このリポジトリはClaude Code(私)とCodexなど複数のエージェント/人が同時に触るため、
`main`ブランチへの直接pushによる衝突が過去に本番ビルド破壊を引き起こしたことがある。
再発防止のため以下のルールに従うこと。

## ディレクトリの使い分け

- `/Users/tomoaki/Documents/projects/kitchen-baton` — `main`固定。Codexさん・本番デプロイ確認用。
- `/Users/tomoaki/Documents/projects/kitchen-baton-claude-work` — `claude/work`ブランチの独立worktree。**Claude Codeはここで作業する。**

git worktreeで物理的にディレクトリが分かれているため、同じファイルを同時編集しても
ディスク上の衝突は起きない(ブランチ切り替えだけでは分離にならない点に注意 — ワーキングツリーは
同じディスク上の同じ場所を指すため、片方の書き込みがもう片方のチェックアウト中ブランチに
そのまま乗ってしまう)。

## mainへの反映フロー

1. `claude/work`側でキリのいいところまで作業・コミット。
2. `main`へ反映する前に必ずユーザーに一声かけて確認する(「今pushしていい？」)。
3. 確認が取れたら `git fetch origin && git rebase origin/main` してからPR作成 or push。
4. `main`への直接pushは避け、PR経由でのマージを基本とする。

## その他

- 個人情報(電話番号・メールアドレス等)はリポジトリにコミットしない、公開データにも含めない。
