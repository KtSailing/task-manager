import { useEffect, useState } from 'react';
import axios from 'axios';

// --- Axios Interceptors 設定 ---
// リクエストログ (メソッド, URL, 送信データ)
axios.interceptors.request.use((config) => {
  console.log(
    `%c🚀 [REQUEST] ${config.method?.toUpperCase()} ${config.url}`,
    'color: blue; font-weight: bold;',
    config.data ? config.data : '' // データがある場合(POST/PUT)は中身を表示
  );
  return config;
});

// レスポンスログ (ステータス, URL, 受信データ)
axios.interceptors.response.use(
  (response) => {
    console.log(
      `%c✅ [RESPONSE] ${response.status} ${response.config.url}`,
      'color: green; font-weight: bold;',
      response.data // <--- これを追加！ここでレスポンスの中身を表示
    );
    return response;
  },
  (error) => {
    console.log(
      `%c❌ [ERROR] ${error.response?.status} ${error.config?.url}`,
      'color: red; font-weight: bold;',
      error.response?.data // エラー時もサーバーからのメッセージを表示
    );
    return Promise.reject(error);
  }
);
// ------------------------------

// 型定義
interface TaskSummary {
  id: number;
  title: string;
}

interface TaskDetail extends TaskSummary {
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskInput {
  title: string;
  description: string;
}

function App() {
  const [tasks, setTasks] = useState<TaskDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTask, setNewTask] = useState<TaskInput>({ title: '', description: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TaskInput>({ title: '', description: '' });

  // N+1問題を意図的に発生させる読み込み関数
  const fetchTasksNPlusOne = async () => {
    setLoading(true);
    console.group('🔥 N+1 Fetch Sequence Started'); // コンソールのグループ化開始

    try {
      // 1. 一覧取得
      const listResponse = await axios.get<TaskSummary[]>('http://localhost:3000/tasks');
      const taskSummaries = listResponse.data;
      console.log(`Received ${taskSummaries.length} items. Starting detail requests...`);

      // 2. 詳細取得 (N回リクエスト)
      const detailPromises = taskSummaries.map(async (summary) => {
        // ここでの個別のログは削除し、Interceptorsに任せます
        const detailResponse = await axios.get<TaskDetail>(`http://localhost:3000/tasks/${summary.id}`);
        return detailResponse.data;
      });

      const fullTasks = await Promise.all(detailPromises);
      setTasks(fullTasks);

    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
      console.groupEnd(); // コンソールのグループ化終了
    }
  };

  useEffect(() => {
    fetchTasksNPlusOne();
  }, []);

  // --- Create (作成) ---
  const handleCreate = async () => {
    if (!newTask.title) return alert("Title is required");
    try {
      await axios.post('http://localhost:3000/tasks', newTask);
      setNewTask({ title: '', description: '' });
      fetchTasksNPlusOne();
    } catch (error) {
      console.error(error);
      alert("Create failed");
    }
  };

  // --- Update (更新) ---
  const startEdit = (task: TaskDetail) => {
    setEditingId(task.id);
    setEditForm({ title: task.title, description: task.description });
  };

  const handleUpdate = async (id: number, currentStatus: string) => {
    try {
      await axios.put(`http://localhost:3000/tasks/${id}`, {
        ...editForm,
        status: currentStatus
      });
      setEditingId(null);
      fetchTasksNPlusOne();
    } catch (error) {
      console.error(error);
      alert("Update failed");
    }
  };

  const toggleStatus = async (task: TaskDetail) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await axios.put(`http://localhost:3000/tasks/${task.id}`, {
        title: task.title,
        description: task.description,
        status: newStatus
      });
      fetchTasksNPlusOne();
    } catch (error) {
      console.error(error);
    }
  }

  // --- Delete (削除) ---
  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure?")) return;
    try {
      await axios.delete(`http://localhost:3000/tasks/${id}`);
      fetchTasksNPlusOne();
    } catch (error) {
      console.error(error);
      alert("Delete failed");
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Task Manager (Axios Interceptor Log)</h1>

      <div style={{ padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>Create New Task</h3>
        <input 
          type="text" 
          placeholder="Title" 
          value={newTask.title}
          onChange={e => setNewTask({...newTask, title: e.target.value})}
          style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px' }}
        />
        <textarea 
          placeholder="Description" 
          value={newTask.description}
          onChange={e => setNewTask({...newTask, description: e.target.value})}
          style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px' }}
        />
        <button onClick={handleCreate} disabled={loading}>Add Task</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Task List</h2>
        <button onClick={fetchTasksNPlusOne} disabled={loading}>
          {loading ? 'Loading...' : 'Force Reload'}
        </button>
      </div>
      <hr />

      <div style={{ marginTop: '20px' }}>
        {tasks.map((task) => (
          <div key={task.id} style={{ 
            border: '1px solid #ccc', 
            borderRadius: '8px', 
            padding: '15px', 
            marginBottom: '15px',
            backgroundColor: task.status === 'completed' ? '#e8f5e9' : 'white'
          }}>
            {editingId === task.id ? (
              <div>
                <input 
                  value={editForm.title} 
                  onChange={e => setEditForm({...editForm, title: e.target.value})}
                  style={{ display: 'block', width: '100%', marginBottom: '5px' }}
                />
                <textarea 
                  value={editForm.description} 
                  onChange={e => setEditForm({...editForm, description: e.target.value})}
                  style={{ display: 'block', width: '100%', marginBottom: '5px' }}
                />
                <button onClick={() => handleUpdate(task.id, task.status)}>Save</button>
                <button onClick={() => setEditingId(null)} style={{ marginLeft: '5px' }}>Cancel</button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: '0 0 10px 0' }}>#{task.id} {task.title}</h3>
                  <div>
                    <button onClick={() => startEdit(task)}>Edit</button>
                    <button onClick={() => handleDelete(task.id)} style={{ marginLeft: '5px', color: 'red' }}>Delete</button>
                  </div>
                </div>
                <p style={{ margin: '5px 0' }}><strong>Status:</strong> 
                  <span 
                    style={{ cursor: 'pointer', color: 'blue', marginLeft: '5px', textDecoration: 'underline' }}
                    onClick={() => toggleStatus(task)}
                  >
                    {task.status}
                  </span>
                </p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{task.description}</p>
                <small style={{ color: '#666' }}>Created: {new Date(task.createdAt).toLocaleString()}</small>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;