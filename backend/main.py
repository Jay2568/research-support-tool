from google import genai
import arxiv
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import json
import os
from dotenv import load_dotenv

# --- 1. AI設定 ---
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY)

# 接続テスト用コード（起動時に自動実行）
try:
    # モデル一覧を取得して、名前に '1.5-flash' が含まれるものを表示
    print("--- 利用可能なモデルを確認中 ---")
    for m in client.models.list():
        if '2.5-flash' in m.name:
            print(f"発見したモデル名: {m.name}")
except Exception as e:
    print(f"モデルリスト取得エラー: {e}")

MODEL_ID = 'gemini-2.5-flash' 

# --- 2. サーバー設定 ---
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# 型定義（エラーの元だった SearchRequest を復活させました）
class SearchRequest(BaseModel):
    text: str

class AiRequest(BaseModel):
    text: str
    bookmarked_papers: list[dict] = []

# --- 3. APIエンドポイント ---

# 【モード1】ノートの内容を分析する（ノートからの相談用）
@app.post("/ask")
async def analyze_note(request: AiRequest):
    try:
        print(f"--- ノート分析開始 ---")
        prompt = f"""
        あなたは研究開発の専門家です。以下の実験ノートの内容を分析し、
        物理的・化学的な観点から「次に試すべき実験」や「データの解釈」を日本語で助言してください。
        
        【実験ノートの内容】
        {request.text}
        
        【参考にする保存済み論文リスト】
        {", ".join([p.get('title', '') for p in request.bookmarked_papers])}
        
        アドバイスは3点、簡潔な箇条書きで答えてください。
        """

        res = client.models.generate_content(
            model=MODEL_ID, 
            contents=prompt
        )
        
        print("✅ ノート分析完了")
        return {"analysis": res.text}

    except Exception as e:
        print(f"❌ エラー発生: {str(e)}")
        return {"error": str(e)}

# 【モード2】新しい論文を探す（検索窓用）
@app.post("/ask_paper")
async def search_arxiv(request: SearchRequest):
    try:
        print(f"--- 論文検索開始: {request.text} ---")
        # 英語キーワード抽出
        eng_res = client.models.generate_content(
            model=MODEL_ID, 
            contents=f"Extract 2 simple English keywords for arXiv search from: {request.text}. ONLY keywords separated by space."
        )
        query_text = eng_res.text.strip().replace('"', '').replace("'", "")
        print(f"検索キーワード: [{query_text}]")

        arxiv_client = arxiv.Client()
        search = arxiv.Search(query=query_text, max_results=3)
        
        results = []
        for result in arxiv_client.results(search):
            results.append({
                "title": result.title,
                "url": result.pdf_url,
                "abstract": result.summary,
                "published": result.published.strftime("%Y-%m-%d")
            })
        
        print(f"✅ 検索完了: {len(results)}件取得")
        return {"papers": results}
    except Exception as e:
        print(f"❌ 検索エラー: {str(e)}")
        return {"error": str(e), "papers": []}

# --- 4. 保存・読み込み機能 ---
SAVE_FILE = "research_data.json"

@app.post("/save_all")
async def save_all(data: dict):
    file_count = len(data.get("files", []))
    if file_count == 0 and os.path.exists(SAVE_FILE):
        return {"status": "ignored"}

    with open(SAVE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    print(f"💾 保存完了")
    return {"status": "success"}

@app.get("/api/load")
async def load_data():
    if os.path.exists(SAVE_FILE):
        with open(SAVE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"files": [], "bookmarks": []}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)