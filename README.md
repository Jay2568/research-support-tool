# Research Support Tool (研究支援ツール)
研究の先行文献管理と、LLM（大規模言語モデル）を活用した論文解析を統合した支援ツールです。

## プロジェクト概要
研究活動における「論文を探す・読む・まとめる」というサイクルを効率化するために開発しました。
バックエンドに Python、フロントエンドに Next.js を使用したフルスタックアプリです。

## 使用技術
### Frontend
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS

### Backend
- **Framework**: Python 
- **API**: OpenAI API (論文要約・解析用)

## 📁 ディレクトリ構成
- `frontend/`: Next.js によるユーザーインターフェース
- `backend/`: Python による解析ロジック・API

### データベースの準備
1. `backend/Research.json.sample` をコピーして `backend/Research.json` を作成してください。
   ```bash
   cp backend/Research.json.sample backend/Research.json

## 起動方法

- cd frontend
- npm install
- npm run dev

- cd backend
- pip install -r requirements.txt
- python main.py




