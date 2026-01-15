"use client";
import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StickyNote {
  id: string;
  text: string;
  x: number;
  y: number;
  linkedPaperUrl?: string; // 付箋に紐付けられた論文URL
}

interface BookmarkedPaper {
  title: string;
  url: string;
  abstract: string;
  figure_info: string;
}

interface LogEntry {
  timestamp: string;
  content: string;
}

interface ResearchFile {
  id: string;
  name: string;
  type: 'research' | 'paper';
  content: string;
  date?: string;
  method?: string;
  results?: string;
  discussion?: string;
  logs: LogEntry[];
  stickies: StickyNote[];
}

export default function LabOSComplete() {
  const [files, setFiles] = useState<ResearchFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [openFileId, setOpenFileId] = useState<string | null>(null); // サイドバーのファイル展開状態
  const [chartsData, setChartsData] = useState<{ [key: string]: any[] }>({});
  const [aiResponse, setAiResponse] = useState("解析準備完了。AIアドバイスは、研究ノートを元に、保存された論文知見と比較して提供されます。");
  const [paperSearchResults, setPaperSearchResults] = useState<any[]>([]); // 論文検索結果
  const [isLoading, setIsLoading] = useState(false);
  const [globalBookmarks, setGlobalBookmarks] = useState<BookmarkedPaper[]>([]); 

  const activeFile = files.find(f => String(f.id) == String(activeFileId));
  const editorRef = useRef<HTMLDivElement>(null); // 付箋の座標計算用
  // --- パネル開閉の状態 ---
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  const [isLoaded, setIsLoaded] = useState(false);

  // --- 初期ロード ---
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/load");
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          setFiles(data.files);
          setActiveFileId(data.files[0].id);
        }
        if (data.bookmarks) setGlobalBookmarks(data.bookmarks);
        
        // 読み込みが終わったことを記録
        setIsLoaded(true); 
      } catch (e) {
        console.error("Load failed", e);
        setIsLoaded(true); 
      }
    };
    loadInitialData();
  }, []);

  // --- オートセーブ ---
  useEffect(() => {
    if (!isLoaded || files.length === 0) return;

    const timer = setTimeout(() => {
      const autoSaveToDisk = async () => {
        const dataToSave = { files, bookmarks: globalBookmarks };
        try {
          await fetch("http://127.0.0.1:8000/save_all", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dataToSave),
          });
          console.log("Auto-save: Success");
        } catch (e) {
          console.warn("Auto-save: Failed");
        }
      };
      autoSaveToDisk();
    }, 2000);

    return () => clearTimeout(timer);
  }, [files, globalBookmarks, isLoaded]); // isLoadedを監視対象に入れる

  // RESULTSテキストを解析してグラフデータを作る処理
  useEffect(() => {
    if (!activeFile || !activeFile.results) {
      setChartsData({});
      return;
    }

    const lines = activeFile.results.split('\n');

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // [グラフ名] を見つけたら切り替える
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentGraphName = trimmed.substring(1, trimmed.length - 1);
        return;
      }

      // 数値の抽出 (例: "10kV 50kPa" -> kv:10, kpa:50)
      // 数字と、その直後の文字（単位）をセットで抽出するように変更
      const matches = trimmed.match(/(\d+\.?\d*)\s*([a-zA-Z℃Ω%]+)?/g);

      if (matches && matches.length >= 2) {
        // 1つ目のデータ（X軸）を解析
        const xPart = matches[0].match(/(\d+\.?\d*)\s*([a-zA-Z℃Ω%]+)?/)as any;
        const xValue = parseFloat(xPart[1]);
        const xUnit = xPart[2] || ""; // 単位があれば取得

        // 2つ目のデータ（Y軸）を解析
        const yPart = matches[1].match(/(\d+\.?\d*)\s*([a-zA-Z℃Ω%]+)?/)as any;
        const yValue = parseFloat(yPart[1]);
        const yUnit = yPart[2] || ""; // 単位があれば取得

        if (!newChartsData[currentGraphName]) {
          newChartsData[currentGraphName] = [];
        }

        newChartsData[currentGraphName].push({
          x: xValue,
          y: yValue,
          xUnit: xUnit, // 単位をデータに含める
          yUnit: yUnit,
          // 後でラベル表示に使うために名前を汎用的にしておく
          name: `Point ${newChartsData[currentGraphName].length + 1}`
        });
      }
    });

    setChartsData(newChartsData);
  }, [activeFile?.results]); // 結果欄が書き換わるたびに実行

    const newChartsData: { [key: string]: any[] } = {};
    let currentGraphName = "メインデータ";

  // --- ファイル操作 ---
  const createNewFile = (type: 'research' | 'paper') => {
    const name = window.prompt("ファイル名を入力", type === 'research' ? "新規実験データ" : "新規論文検索");
    if (!name) return;
    const newFile: ResearchFile = { id: Date.now().toString(), name, type, content: "", logs: [], stickies: [] };
    const updated = [...files, newFile];
    setFiles(updated);
    setActiveFileId(newFile.id); // 作成したら自動で開く
    setOpenFileId(newFile.id); // サイドバーも開く
  };

  const deleteFile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); 
    if (!window.confirm("本当に削除しますか？")) return;

    const updatedFiles = files.filter(f => f.id !== id);
    setFiles(updatedFiles);
    if (activeFileId === id) setActiveFileId(null);
    if (openFileId === id) setOpenFileId(null);
  };


  const saveLogOnly = () => {
    if (!activeFileId || !activeFile) return;

    // 各項目をバラバラのまま保存する
    const logEntry = {
      timestamp: new Date().toLocaleString(),
      // 検索用に1つの文字列としても持っておく
      content: `${activeFile.method} ${activeFile.results} ${activeFile.discussion}`,
      snapshot: {
        date: activeFile.date,
        method: activeFile.method,
        results: activeFile.results,
        discussion: activeFile.discussion,
      },
      stickies: JSON.parse(JSON.stringify(activeFile.stickies)) // 参照を切ってディープコピー
    };

    setFiles(prev => prev.map(f =>
      f.id === activeFileId ? {
        ...f,
        logs: [logEntry, ...f.logs.slice(0, 19)]
      } : f
    ));
    alert("全項目の状態をログに刻印しました！");
  };

  const getAiAdvice = async () => {
    if (!activeFileId || isLoading) return;
    
    setIsLoading(true); // ローディング開始

    // 1. ノートの各項目をテキストにまとめる
    const noteFullText = `
      【日付】: ${activeFile!.date || '未設定'}
      【実験手法】: ${activeFile!.method || '未記入'}
      【実験結果】: ${activeFile!.results || '未記入'}
      【考察】: ${activeFile!.discussion || '未記入'}
    `;

    try {
      // 2. Pythonの /ask エンドポイントへ送信
      const response = await fetch("http://127.0.0.1:8000/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: noteFullText,
          bookmarked_papers: globalBookmarks // ブックマーク済みの論文データも送る
        }),
      });
      
      const data = await response.json();

      if (data.analysis) {
        setAiResponse(data.analysis);
      } else if (data.error) {
        setAiResponse("⚠️ エラーが発生しました: " + data.error);
      }
    } catch (err) {
      setAiResponse("❌ サーバーに接続できませんでした。Pythonが起動しているか確認してください。");
    } finally {
      setIsLoading(false); // ローディング終了
    }
  };

  const executeSearch = async (keyword: string, isHistory: boolean) => {
    if (!activeFileId || !keyword.trim()) return;
    setIsLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/ask_paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: keyword }),
      });
      const result = await response.json();
      setPaperSearchResults(result.papers || []);

      // 履歴クリックじゃない時だけ、新しくログに保存する
      if (!isHistory) {
        const logEntry = {
          timestamp: new Date().toLocaleString(),
          content: keyword,
          isSearchLog: true 
        };
        setFiles(prev => prev.map(f =>
          f.id === activeFileId ? { ...f, logs: [logEntry, ...f.logs.slice(0, 19)] } : f
        ));
      }
    } catch (e) {
      alert("検索エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  // 検索ボタンから呼ばれる窓口
  const handlePaperSearch = () => {
    if (!activeFile?.content?.trim()) {
      alert("検索キーワードを入力してください");
      return;
    }
    executeSearch(activeFile.content, false);
  };

  // サイドバーの履歴をクリックした時の窓口
  const handleHistorySearch = (text: string) => {
    executeSearch(text, true);
  };

  // 各入力欄の更新を処理する関数
  const updateContent = (field: string, value: string) => {
    if (!activeFileId) return;
    setFiles(prev => prev.map(f => 
      f.id === activeFileId ? { ...f, [field]: value } : f
    ));
  };


  // --- 付箋操作 ---
  const addSticky = () => {
    if (!activeFileId) return;
    const newSticky: StickyNote = {
      id: Date.now().toString(),
      text: "新しい気づき",
      x: 50 + Math.random() * 100, // 少しずらして配置
      y: 50 + Math.random() * 100,
      linkedPaperUrl: ""
    };
    setFiles(files.map(f => f.id === activeFileId ? { ...f, stickies: [...f.stickies, newSticky] } : f));
  };

  const updateSticky = (stickyId: string, updates: Partial<StickyNote>) => {
    setFiles(prev => prev.map(f =>
      f.id === activeFileId ? {
        ...f,
        stickies: f.stickies.map(s => s.id === stickyId ? { ...s, ...updates } : s)
      } : f
    ));
  };

  const handleAnalyzeNote = async () => {
    if (!activeFile) return;

    const noteFullText = `
      DATE: ${activeFile.date}
      METHOD: ${activeFile.method}
      RESULTS: ${activeFile.results}
      DISCUSSION: ${activeFile.discussion}
    `;

    try {
      const response = await fetch("http://127.0.0.1:8000/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: noteFullText,
          bookmarked_papers: globalBookmarks 
        }),
      });
      
      const data = await response.json();

      if (data.analysis) {
        alert("🤖AIのアドバイス:\n\n" + data.analysis); 
      } else if (data.error) {
        alert("エラー: " + data.error);
      }
    } catch (err) {
      alert("サーバーに接続できませんでした。");
    }
  };

  const removeSticky = (stickyId: string) => {
    setFiles(files.map(f =>
      f.id === activeFileId ? {
        ...f,
        stickies: f.stickies.filter(s => s.id !== stickyId)
      } : f
    ));
  };

  // --- ドラッグ＆ドロップ機能 (付箋移動) ---
  const handleDragStart = (e: any, stickyId: string) => {
    e.dataTransfer.setData("stickyId", stickyId);
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragOver = (e: any) => {
    e.preventDefault(); 
  };

  const handleDrop = (e: any) => {
    e.preventDefault();
    // 送信時と同じキー名 "stickyId" で取得
    const stickyId = e.dataTransfer.getData("stickyId");
    if (!stickyId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    
    // スクロール量を加算
    const scrollY = e.currentTarget.scrollTop; 
    const scrollX = e.currentTarget.scrollLeft;
    const x = e.clientX - rect.left + scrollX - 100;
    const y = e.clientY - rect.top + scrollY - 40;

    // IDは文字列,Number() に変換せずそのまま渡す
    updateSticky(stickyId, { x, y });
  };

  const toggleGlobalBookmark = (paper: BookmarkedPaper) => {
    setGlobalBookmarks(prev => {
      const exists = prev.find(b => b.url === paper.url);
      if (exists) {
        return prev.filter(b => b.url !== paper.url);
      } else {
        return [...prev, paper];
      }
    });
  };

  // --- メインレンダリング ---
  return (
    <main className="flex h-screen bg-slate-950 text-slate-200 p-4 gap-4 overflow-hidden">
      {/* 左：サイドバー */}
      {leftPanelOpen && (
        <div className="w-72 flex flex-col gap-4 overflow-hidden shrink-0 relative">
          <button 
            onClick={() => setLeftPanelOpen(false)}
            className="absolute right-2 top-2 z-50 p-1 text-slate-500 hover:text-white transition-colors"
          >
            ☰
          </button>
          <div className="w-72 flex flex-col gap-4 overflow-hidden">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col gap-2 flex-1 overflow-hidden">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Projects & History</span>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button onClick={() => createNewFile('research')} className="bg-blue-600/20 text-blue-400 border border-blue-500/50 p-2 rounded text-[10px] font-bold hover:bg-blue-600/40">+ 実験ノート</button>
                <button onClick={() => createNewFile('paper')} className="bg-purple-600/20 text-purple-400 border border-purple-500/50 p-2 rounded text-[10px] font-bold hover:bg-purple-600/40">+ 論文検索</button>
              </div>
              <div className="overflow-y-auto space-y-2 pr-2 flex-1">
                {files.map(f => (
                  <div key={f.id} className={`border rounded-lg overflow-hidden ${activeFileId === f.id ? 'border-blue-500 bg-slate-800' : 'border-slate-800 bg-slate-900/50'}`}>
                    <div onClick={() => { setActiveFileId(f.id); setOpenFileId(openFileId === f.id ? null : f.id); }} className="p-3 cursor-pointer flex justify-between items-center transition-colors hover:bg-slate-800">
                      <span className="text-xs font-bold truncate flex-1">
                        {f.type === 'research' ? '📊' : '📚'} {f.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => deleteFile(e, f.id)} className="text-slate-600 hover:text-red-500 text-[10px] p-1">🗑️</button>
                        <span className="text-[10px]">{openFileId === f.id ? '▼' : '▶'}</span>
                      </div>
                    </div>

                    {/* ログ一覧（折り畳み部分） */}
                    {openFileId === f.id && (
                      <div className="bg-slate-950/50 border-t border-slate-800 py-1 space-y-1">
                        {f.logs.length === 0 && <div className="p-2 text-[10px] text-slate-600 italic">履歴なし</div>}
                        {/* ログ一覧（折り畳み部分） */}
                        {openFileId === f.id && (
                          <div className="bg-slate-950/50 border-t border-slate-800 py-1 space-y-1">
                            {f.logs.length === 0 && <div className="p-2 text-[10px] text-slate-600 italic">履歴なし</div>}
                            
                            {f.logs.map((l: any, i) => (
                              <div 
                                key={i} 
                                className={`group flex items-center justify-between p-2 text-[9px] cursor-pointer border-l-2 border-transparent transition-all hover:bg-slate-800 ${
                                  l.isSearchLog ? 'text-purple-400 hover:border-purple-500' : 'text-slate-500 hover:border-emerald-500'
                                }`}
                              >
                                {/* 左側：クリックで復元・再検索 */}
                                <div 
                                  className="flex-1 truncate pr-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // 論文検索モードの場合
                                    if (f.type === 'paper' && l.isSearchLog) {
                                      setFiles(prev => prev.map(file => file.id === f.id ? { ...file, content: l.content } : file));
                                      handleHistorySearch(l.content);
                                    } else {
                                      // 実験ノートモードの復元処理
                                      setFiles(prevFiles => prevFiles.map(file => {
                                        if (file.id === f.id) {
                                          return { 
                                            ...file, 
                                            date: l.snapshot?.date || (l.content.includes('【日時】') ? l.content.split('【日時】:')[1]?.split('\n')[0].trim() : ""),
                                            method: l.snapshot?.method || (l.content.includes('【方法】') ? l.content.split('【方法】:')[1]?.split('\n')[0].trim() : ""),
                                            results: l.snapshot?.results || (l.content.includes('【結果】') ? l.content.split('【結果】:')[1]?.split('\n')[0].trim() : ""),
                                            discussion: l.snapshot?.discussion || (l.content.includes('【考察】') ? l.content.split('【考察】:')[1]?.split('\n')[0].trim() : ""),
                                            stickies: l.stickies || file.stickies 
                                          };
                                        }
                                        return file;
                                      }));
                                    }
                                  }}
                                >
                                  {l.isSearchLog ? '🔍 ' : '⏱ '} 
                                  {l.timestamp.split(' ')[1]} 
                                  :{l.content.length > 8 ? l.content.substring(0, 8) + '…' : l.content}
                                </div>

                                {/* 右側：履歴削除ボタン（ゴミ箱） */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm("この履歴を削除してもよろしいですか？")) {
                                      setFiles(prev => prev.map(file => 
                                        file.id === f.id ? { ...file, logs: file.logs.filter((_, index) => index !== i) } : file
                                      ));
                                    }
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                                >
                                  🗑️
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 共通のお気に入り論文ライブラリ */}
              <div className="mt-auto border-t border-slate-800 pt-4">
                <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest px-2">⭐ Saved Papers Library</span>
                <div className="overflow-y-auto max-h-40 space-y-1 mt-2 pr-2">
                  {globalBookmarks.length === 0 && <div className="text-[10px] text-slate-600 italic p-2">お気に入り論文なし</div>}
                  {globalBookmarks.map((b, i) => (
                    <div key={i} className="group flex items-center gap-1 mb-1">
                      <a 
                        href={b.url} 
                        target="_blank" 
                        className="text-[10px] p-2 bg-slate-800 rounded flex-1 flex items-center justify-between hover:bg-slate-700 transition group"
                      >
                        <span className="truncate text-slate-300 group-hover:text-blue-400">
                          📚 {b.title.length > 15 ? b.title.substring(0, 15) + '…' : b.title}
                        </span>
                        <span className="text-slate-500 group-hover:text-white shrink-0 ml-1">↗️</span>
                      </a>
                      <button 
                        onClick={() => {
                          if (window.confirm("この論文をライブラリから削除しますか？")) {
                            toggleGlobalBookmark(b);
                          }
                        }}
                        className="p-2 text-slate-600 hover:text-red-500 transition-colors bg-slate-900 rounded"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      

      {/* 中央：メイン表示エリア */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 relative">
        {!leftPanelOpen && (
          <button 
            onClick={() => setLeftPanelOpen(true)}
            className="absolute left-0 top-2 z-50 p-2 bg-slate-800/50 rounded-r-md hover:bg-slate-700 text-xs border border-l-0 border-slate-700"
          >
            ▶
          </button>
        )}

        {!rightPanelOpen && (
          <button 
            onClick={() => setRightPanelOpen(true)}
            className="absolute right-0 top-2 z-50 p-2 bg-slate-800/50 rounded-l-md hover:bg-slate-700 text-xs border border-r-0 border-slate-700"
          >
            ◀
          </button>
        )}
        {!activeFile ? (
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-600 text-xl font-thin tracking-widest uppercase">
            Select or Create a Research File
          </div>
        ) : activeFile.type === 'paper' ? (
          /* --- 論文検索モード --- */
          <div className="flex flex-col gap-6 h-full">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex gap-4 shrink-0">
              <input 
                className="flex-1 p-3 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none text-slate-900"
                placeholder="調べたいテーマやキーワードを入力..."
                value={activeFile.content}
                onChange={(e) => {
                  const newText = e.target.value;
                  setFiles(prev => prev.map(f => 
                    f.id === activeFileId ? { ...f, content: newText } : f
                  ));
                }}
              />
              <button onClick={handlePaperSearch} disabled={isLoading} className="bg-purple-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-purple-700 transition">
                {isLoading ? "検索中..." : "論文検索"}
              </button>
            </div>
            <div className="space-y-6 pb-20 overflow-y-auto">
              {paperSearchResults.map((paper, index) => (
                <div key={index} className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden text-slate-800">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4 gap-4">
                      <h3 className="text-lg font-bold leading-tight flex-1">{paper.title}</h3>
                      <div className="flex gap-2">
                        <button onClick={() => toggleGlobalBookmark(paper)} className="text-xl text-yellow-500">
                          {globalBookmarks.find(b => b.url === paper.url) ? '⭐' : '☆'}
                        </button>
                        <a href={paper.url} target="_blank" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap">PDFを開く</a>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 overflow-hidden">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Abstract (Original)</span>
                        <p className="text-[13px] leading-relaxed line-clamp-6 hover:line-clamp-none transition-all cursor-pointer overflow-y-auto max-h-48">{paper.abstract}</p>
                      </div>
                      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 overflow-hidden">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase block mb-2">AI Insights: Figures & Data</span>
                        <div className="text-[13px] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{paper.figure_info}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* --- 実験ノートモード --- */
          <>
            <div 
              ref={editorRef} // ドラッグ＆ドロップの基準点として設定
              className="min-h-[400px] bg-white text-slate-900 rounded-2xl flex flex-col shadow-2xl border border-slate-300 relative overflow-hidden"
            >
              <div className="bg-slate-100 px-6 py-3 border-b flex justify-between items-center">
                <span className="font-bold text-slate-500 text-sm tracking-tight">{activeFile.name}</span>
                <div className="flex gap-2">
                  <div className="flex gap-2">
                    <button onClick={addSticky} className="bg-yellow-400 text-black px-4 py-1 rounded-full text-xs font-bold shadow-md hover:bg-yellow-500 transition">
                      + 付箋を追加
                    </button>
                    
                    <button onClick={saveLogOnly} className="bg-emerald-600 text-white px-5 py-1 rounded-full text-xs font-bold shadow-md hover:bg-emerald-700 transition">
                      今の状態をログに刻印
                    </button>
                  </div>
                </div>
              </div>
              {/* 実験ノートの構造化入力エリア */}
              <div 
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="flex-1 overflow-y-auto p-6 space-y-4 relative">
                <div className="grid grid-cols-1 gap-4">
                  
                  {/* 1. 日時 */}
                  <div>
                    <label className="text-[10px] text-emerald-500 font-bold mb-1 block">📅 DATE / TIME</label>
                    <input 
                      type="text"
                      placeholder="2024/05/20 14:00"
                      className="w-full bg-slate-900/50 border border-slate-800 rounded p-2 text-sm text-white outline-none focus:border-emerald-500"
                      value={activeFile?.date || new Date().toLocaleString()}
                      onChange={(e) => updateContent('date', e.target.value)}
                    />
                  </div>

                  {/* 2. 実験内容・方法 */}
                  <div>
                    <label className="text-[10px] text-emerald-500 font-bold mb-1 block">🧪 METHOD / CONTENT</label>
                    <textarea 
                      placeholder="実験の目的や手順を記入..."
                      className="w-full h-32 bg-slate-900/50 border border-slate-800 rounded p-3 text-sm text-white outline-none focus:border-emerald-500 resize-none"
                      value={activeFile?.method || ''}
                      onChange={(e) => updateContent('method', e.target.value)}
                    />
                  </div>

                  {/* 3. 結果 */}
                  <div>
                    <label className="text-[10px] text-blue-400 font-bold mb-1 block flex justify-between">
                      <span>📊 RESULTS (Write like: 10kV 50kPa)</span>
                      <span className="text-slate-500 font-normal">※[グラフ名]で分割可能</span>
                    </label>
                    <textarea 
                      placeholder="例:&#10;10kV 50kPa&#10;20kV 80kPa&#10;[実験2]&#10;10kV 40kPa..."
                      className="w-full h-40 bg-slate-900/50 border border-slate-800 rounded p-3 text-sm text-white outline-none focus:border-blue-500 font-mono"
                      value={activeFile?.results || ''}
                      onChange={(e) => updateContent('results', e.target.value)}
                    />
                  </div>

                  {/* 4. 考察 */}
                  <div>
                    <label className="text-[10px] text-purple-400 font-bold mb-1 block">💡 DISCUSSION</label>
                    <textarea 
                      placeholder="結果から考察できること、次の課題..."
                      className="w-full h-32 bg-slate-900/50 border border-slate-800 rounded p-3 text-sm text-white outline-none focus:border-purple-500 resize-none"
                      value={activeFile?.discussion || ''}
                      onChange={(e) => updateContent('discussion', e.target.value)}
                    />
                  </div>

                </div>
                {/* 吹き出し付箋の描画 */}
                {activeFile.stickies?.map(s => (
                  <div
                    key={s.id}
                    id={`sticky-${s.id}`} // ドラッグ用のID
                    style={{ left: s.x, top: s.y }}
                    className="absolute p-3 bg-yellow-200 rounded-2xl shadow-xl w-52 border-2 border-white/50 cursor-grab z-10 text-slate-800"
                    draggable
                    onDragStart={(e) => handleDragStart(e, s.id)}
                    onDragEnd={(e) => e.currentTarget.classList.remove('opacity-50')}
                  >
                    <div className="absolute -bottom-2 left-6 w-4 h-4 bg-inherit rotate-45 border-r-2 border-b-2 border-white/50"></div>
                    <textarea
                      className="bg-transparent w-full h-16 text-sm font-bold focus:outline-none resize-none overflow-hidden"
                      value={s.text} // valueに戻す
                      onChange={(e) => {
                        e.stopPropagation();
                        updateSticky(s.id, { text: e.target.value });
                      }}
                    />
                    <select
                      className="bg-yellow-300 text-[10px] w-full mt-1 p-1 rounded focus:outline-none"
                      value={s.linkedPaperUrl || ""}
                      onChange={(e) => updateSticky(s.id, { linkedPaperUrl: e.target.value })}
                    >
                      <option value="">論文を選択してリンク</option>
                      {globalBookmarks.map(b => (
                        <option key={b.url} value={b.url}>{b.title.substring(0, 30)}...</option>
                      ))}
                    </select>
                    {s.linkedPaperUrl && (
                      <a href={s.linkedPaperUrl} target="_blank" className="block text-blue-600 text-[10px] mt-1 hover:underline truncate">🔗 論文へ</a>
                    )}
                    <button
                      onClick={() => removeSticky(s.id)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold hover:bg-red-600 transition"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-10">
              {Object.keys(chartsData).map(name => {
                // このグラフの最初のデータから単位を取得する（なければデフォルト値）
                const firstData = chartsData[name][0];
                const xLabel = firstData?.xUnit || "X軸";
                const yLabel = firstData?.yUnit || "Y軸";

                return (
                  <div key={name} className="bg-white p-5 rounded-2xl shadow-lg border border-slate-200 h-72">
                    <h3 className="text-slate-400 font-bold text-[10px] mb-4 uppercase tracking-widest">Graph Analysis: {name}</h3>
                    <ResponsiveContainer width="100%" height="85%">
                      <LineChart data={chartsData[name]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />                        
                        {/* X軸: dataKeyを "x" にし、labelを追加 */}
                        <XAxis 
                          dataKey="x" 
                          fontSize={11} 
                          stroke="#94a3b8" 
                          label={{ value: xLabel, position: 'insideBottomRight', offset: -5, fontSize: 10, fill: '#94a3b8' }}
                        />                        
                        {/* Y軸: labelを追加（単位を表示） */}
                        <YAxis 
                          fontSize={11} 
                          stroke="#94a3b8" 
                          label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }}
                        /> 
                        <Tooltip 
                          labelStyle={{ color: '#f8fafc', fontWeight: 'bold', marginBottom: '4px' }} 
                          contentStyle={{ 
                            borderRadius: '12px', 
                            backgroundColor: '#1e293b', 
                            border: '1px solid #334155',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' 
                          }}
                          // 2. 数値部分の表示設定
                          formatter={(value, name, props) => {
                            const unit = props.payload.yUnit || "";
                            return [`${value} ${unit}`, "測定値"]; 
                          }}
                          // 3. ラベル（X軸）の表示設定
                          labelFormatter={(label, payload) => {
                            const unit = payload[0]?.payload?.xUnit || "";
                            return `条件: ${label} ${unit}`; 
                          }}
                        />                        
                        <Line 
                          type="monotone" 
                          dataKey="y" 
                          stroke="#2563eb" 
                          strokeWidth={4} 
                          dot={{r:5, fill:'#2563eb', strokeWidth:2, stroke:'#fff'}} 
                          activeDot={{r:7}} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 右：AIアドバイスパネル */}
      {rightPanelOpen && (
        <div className="w-80 flex flex-col gap-4 shrink-0 h-[calc(100vh-120px)] relative"> 
        <button 
          onClick={() => setRightPanelOpen(false)}
          className="absolute right-4 top-4 z-50 p-1 text-slate-500 hover:text-white transition-colors"
        >
          ☰
        </button>
          <div className="flex flex-col h-full bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl overflow-hidden"> 
            <h2 className="text-indigo-400 font-bold mb-4 text-xs tracking-widest uppercase">AI Research Assistant</h2>
            <button 
              onClick={getAiAdvice} 
              disabled={isLoading || activeFile?.type === 'paper'} 
              className={`w-full py-4 rounded-xl font-bold text-white mb-6 shadow-lg shrink-0 transition active:scale-95 ${
                isLoading ? 'bg-slate-600' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110'
              }`}
            >
              {isLoading ? "AI思考中..." : "AIに研究のアドバイスを仰ぐ"}
            </button>
            <div className="flex-1 min-h-0 bg-slate-950 rounded-xl p-5 overflow-y-auto border border-slate-800 shadow-inner">
              <p className="text-sm leading-relaxed text-slate-400 italic whitespace-pre-wrap">
                {aiResponse || "アドバイスがここに表示されます。"}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}