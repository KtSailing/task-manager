// client/src/App.tsx
import { useEffect, useState } from 'react';
import axios from 'axios';

// --- Axios Interceptors (変更なし) ---
axios.interceptors.request.use((config) => {
  console.log(`%c🚀 [REQUEST] ${config.method?.toUpperCase()} ${config.url}`, 'color: blue; font-weight: bold;', config.data ? config.data : '' );
  return config;
});
axios.interceptors.response.use(
  (response) => {
    console.log(`%c✅ [RESPONSE] ${response.status} ${response.config.url}`,'color: green; font-weight: bold;', response.data);
    return response;
  },
  (error) => {
    console.log(`%c❌ [ERROR] ${error.response?.status} ${error.config?.url}`,'color: red; font-weight: bold;', error.response?.data);
    return Promise.reject(error);
  }
);

// --- 型定義 ---
interface Tag {
  name: string;
}

interface TaskSummary {
  id: number;
  title: string;
}

interface TaskDetail extends TaskSummary {
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  Tags: Tag[]; // サーバーから返るタグ情報
}

interface TaskInput {
  title: string;
  description: string;
  tagsStr: string; // 入力用のカンマ区切り文字列
}

function App() {
  const [tasks, setTasks] = useState<TaskDetail[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 検索用State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTag, setSearchTag] = useState('');

  // フォーム用State
  const [newTask, setNewTask] = useState<TaskInput>({ title: '', description: '', tagsStr: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TaskInput>({ title: '', description: '', tagsStr: '' });

  // --- N+1問題を意図的に発生させる読み込み関数 (検索対応) ---
  const fetchTasksNPlusOne = async () => {
    setLoading(true);
    console.group('🔥 N+1 Search & Fetch Sequence');

    try {
      // 1. 一覧取得 (検索パラメータを付与)
      // Query Params: ?q=word&tag=tagName
      const params: any = {};
      if (searchQuery) params.q = searchQuery;
      if (searchTag) params.tag = searchTag;

      const listResponse = await axios.get<TaskSummary[]>('http://localhost:3000/tasks', { params });
      const taskSummaries = listResponse.data;
      console.log(`Matched ${taskSummaries.length} items. Fetching details...`);

      // 2. 詳細取得 (ヒットした数だけN回リクエスト)
      const detailPromises = taskSummaries.map(async (summary) => {
        const detailResponse = await axios.get<TaskDetail>(`http://localhost:3000/tasks/${summary.id}`);
        return detailResponse.data;
      });

      const fullTasks = await Promise.all(detailPromises);
      setTasks(fullTasks);

    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  };

  // 初回ロード
  useEffect(() => {
    fetchTasksNPlusOne();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回のみ。検索時はボタンで発火させる

  // タグ文字列("tag1, tag2")を配列に変換するヘルパー
  const parseTags = (str: string) => {
    return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
  };

  // --- Create ---
  const handleCreate = async () => {
    if (!newTask.title) return alert("Title required");
    try {
      await axios.post('http://localhost:3000/tasks', {
        ...newTask,
        tags: parseTags(newTask.tagsStr) // 配列に変換して送信
      });
      setNewTask({ title: '', description: '', tagsStr: '' });
      fetchTasksNPlusOne();
    } catch (error) { console.error(error); }
  };

  // --- Update ---
  const startEdit = (task: TaskDetail) => {
    setEditingId(task.id);
    // 既存のタグ配列をカンマ区切り文字列に戻してフォームにセット
    const tagsStr = task.Tags ? task.Tags.map(t => t.name).join(', ') : '';
    setEditForm({ title: task.title, description: task.description, tagsStr });
  };

  const handleUpdate = async (id: number, currentStatus: string) => {
    try {
      await axios.put(`http://localhost:3000/tasks/${id}`, {
        title: editForm.title,
        description: editForm.description,
        status: currentStatus,
        tags: parseTags(editForm.tagsStr)
      });
      setEditingId(null);
      fetchTasksNPlusOne();
    } catch (error) { console.error(error); }
  };

  // ステータス更新
  const toggleStatus = async (task: TaskDetail) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    // 更新時はタグ情報も維持して送る必要あり（またはサーバー側でタグ引数がなければ無視する実装にするが、今回はPUTなので全情報を送る）
    const tags = task.Tags.map(t => t.name);
    try {
      await axios.put(`http://localhost:3000/tasks/${task.id}`, {
        title: task.title,
        description: task.description,
        status: newStatus,
        tags: tags
      });
      fetchTasksNPlusOne();
    } catch (error) { console.error(error); }
  }

  // --- Delete ---
  const handleDelete = async (id: number) => {
    if (!confirm("Delete?")) return;
    try {
      await axios.delete(`http://localhost:3000/tasks/${id}`);
      fetchTasksNPlusOne();
    } catch (error) { console.error(error); }
  };

  // タグクリックで検索
  const clickTag = (tagName: string) => {
    setSearchTag(tagName);
    // State更新は非同期なので、少し強引だが即座に検索関数を呼ぶなら引数を渡す設計の方が良い。
    // 今回は簡易的に「検索ボタンを押してね」スタイル、またはuseEffectでフックする形にする。
    // ここでは検索ボックスに入力だけして、次の検索実行を待つ形にします。
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Task Manager (Search + Tags)</h1>

      {/* 検索バー */}
      <div style={{ padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input 
          type="text" 
          placeholder="Search keywords..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ flex: 1, padding: '8px' }}
        />
        <input 
          type="text" 
          placeholder="Filter by tag..." 
          value={searchTag}
          onChange={e => setSearchTag(e.target.value)}
          style={{ flex: 1, padding: '8px' }}
        />
        <button onClick={fetchTasksNPlusOne} disabled={loading}>Search</button>
        {(searchQuery || searchTag) && (
          <button onClick={() => { setSearchQuery(''); setSearchTag(''); }}>Clear</button>
        )}
      </div>

      {/* 新規作成フォーム */}
      <div style={{ padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>Create New Task</h3>
        <input 
          type="text" placeholder="Title" value={newTask.title}
          onChange={e => setNewTask({...newTask, title: e.target.value})}
          style={{ display: 'block', width: '100%', marginBottom: '5px', padding: '8px' }}
        />
        <input 
          type="text" placeholder="Tags (comma separated: work, urgent)" value={newTask.tagsStr}
          onChange={e => setNewTask({...newTask, tagsStr: e.target.value})}
          style={{ display: 'block', width: '100%', marginBottom: '5px', padding: '8px' }}
        />
        <textarea 
          placeholder="Description" value={newTask.description}
          onChange={e => setNewTask({...newTask, description: e.target.value})}
          style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px' }}
        />
        <button onClick={handleCreate} disabled={loading}>Add Task</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>Results ({tasks.length})</h2>
      </div>
      <hr />

      {/* リスト表示 */}
      <div style={{ marginTop: '20px' }}>
        {tasks.map((task) => (
          <div key={task.id} style={{ 
            border: '1px solid #ccc', borderRadius: '8px', padding: '15px', marginBottom: '15px',
            backgroundColor: task.status === 'completed' ? '#e8f5e9' : 'white'
          }}>
            {editingId === task.id ? (
              // 編集モード
              <div>
                <input 
                  value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})}
                  style={{ width: '100%', marginBottom: '5px' }} placeholder="Title"
                />
                 <input 
                  value={editForm.tagsStr} onChange={e => setEditForm({...editForm, tagsStr: e.target.value})}
                  style={{ width: '100%', marginBottom: '5px' }} placeholder="Tags"
                />
                <textarea 
                  value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})}
                  style={{ width: '100%', marginBottom: '5px' }} placeholder="Description"
                />
                <button onClick={() => handleUpdate(task.id, task.status)}>Save</button>
                <button onClick={() => setEditingId(null)} style={{ marginLeft: '5px' }}>Cancel</button>
              </div>
            ) : (
              // 表示モード
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: '0 0 5px 0' }}>#{task.id} {task.title}</h3>
                  <div>
                    <button onClick={() => startEdit(task)}>Edit</button>
                    <button onClick={() => handleDelete(task.id)} style={{ marginLeft: '5px', color: 'red' }}>Delete</button>
                  </div>
                </div>

                {/* タグ表示 */}
                <div style={{ marginBottom: '10px' }}>
                  {task.Tags && task.Tags.map(tag => (
                    <span key={tag.name} 
                      onClick={() => { setSearchTag(tag.name); }}
                      style={{ 
                        display: 'inline-block', backgroundColor: '#2196F3', color: 'white', 
                        padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', 
                        marginRight: '5px', cursor: 'pointer' 
                      }}>
                      {tag.name}
                    </span>
                  ))}
                </div>
                
                <p style={{ margin: '5px 0' }}><strong>Status:</strong> 
                  <span onClick={() => toggleStatus(task)} style={{ cursor: 'pointer', color: 'blue', marginLeft: '5px', textDecoration: 'underline' }}>
                    {task.status}
                  </span>
                </p>
                <p style={{ whiteSpace: 'pre-wrap', color: '#333' }}>{task.description}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;