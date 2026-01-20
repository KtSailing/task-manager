// client/src/App.tsx
import { useEffect, useState } from 'react';
import axios from 'axios';

// --- Axios Interceptors ---
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
  due_date: string | null; // 一覧でも返ってくる
}

interface TaskDetail extends TaskSummary {
  description: string; // ※UIでは非表示にするが、データとしては取得する
  status: string;
  createdAt: string;
  updatedAt: string;
  Tags: Tag[];
}

interface TaskInput {
  title: string;
  description: string;
  due_date: string; // 入力フォーム用 (YYYY-MM-DD)
  tagsStr: string;
}

function App() {
  const [tasks, setTasks] = useState<TaskDetail[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTag, setSearchTag] = useState('');

  const [newTask, setNewTask] = useState<TaskInput>({ title: '', description: '', due_date: '', tagsStr: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TaskInput>({ title: '', description: '', due_date: '', tagsStr: '' });

  // --- N+1 Fetch (変更なし) ---
  const fetchTasksNPlusOne = async () => {
    setLoading(true);
    console.group('🔥 N+1 Sequence');

    try {
      const params: any = {};
      if (searchQuery) params.q = searchQuery;
      if (searchTag) params.tag = searchTag;

      // 1. 一覧取得 (ここで既に期限日順にソートされている)
      const listResponse = await axios.get<TaskSummary[]>('http://localhost:3000/tasks', { params });
      const taskSummaries = listResponse.data;
      console.log(`Matched ${taskSummaries.length} items. Fetching details...`);

      // 2. 詳細取得 (Descriptionなどを取るためにN回リクエストするが、画面にはDescriptionを出さない)
      const detailPromises = taskSummaries.map(async (summary) => {
        const detailResponse = await axios.get<TaskDetail>(`http://localhost:3000/tasks/${summary.id}`);
        return detailResponse.data;
      });

      const fullTasks = await Promise.all(detailPromises);
      setTasks(fullTasks);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  };

  useEffect(() => {
    fetchTasksNPlusOne();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parseTags = (str: string) => {
    return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
  };

  // --- Create ---
  const handleCreate = async () => {
    if (!newTask.title) return alert("Title required");
    try {
      await axios.post('http://localhost:3000/tasks', {
        ...newTask,
        tags: parseTags(newTask.tagsStr)
      });
      setNewTask({ title: '', description: '', due_date: '', tagsStr: '' });
      fetchTasksNPlusOne();
    } catch (error) { console.error(error); }
  };

  // --- Update ---
  const startEdit = (task: TaskDetail) => {
    setEditingId(task.id);
    const tagsStr = task.Tags ? task.Tags.map(t => t.name).join(', ') : '';
    setEditForm({ 
      title: task.title, 
      description: task.description, 
      due_date: task.due_date || '', // nullの場合は空文字に
      tagsStr 
    });
  };

  const handleUpdate = async (id: number, currentStatus: string) => {
    try {
      await axios.put(`http://localhost:3000/tasks/${id}`, {
        title: editForm.title,
        description: editForm.description,
        due_date: editForm.due_date,
        status: currentStatus,
        tags: parseTags(editForm.tagsStr)
      });
      setEditingId(null);
      fetchTasksNPlusOne();
    } catch (error) { console.error(error); }
  };

  const toggleStatus = async (task: TaskDetail) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const tags = task.Tags.map(t => t.name);
    try {
      await axios.put(`http://localhost:3000/tasks/${task.id}`, {
        title: task.title,
        description: task.description,
        due_date: task.due_date,
        status: newStatus,
        tags: tags
      });
      fetchTasksNPlusOne();
    } catch (error) { console.error(error); }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Delete?")) return;
    try {
      await axios.delete(`http://localhost:3000/tasks/${id}`);
      fetchTasksNPlusOne();
    } catch (error) { console.error(error); }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Task Manager (Sorted by Due Date)</h1>

      {/* 検索バー */}
      <div style={{ padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input 
          type="text" placeholder="Search keywords..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)} style={{ flex: 1, padding: '8px' }}
        />
        <input 
          type="text" placeholder="Filter by tag..." value={searchTag}
          onChange={e => setSearchTag(e.target.value)} style={{ flex: 1, padding: '8px' }}
        />
        <button onClick={fetchTasksNPlusOne} disabled={loading}>Search</button>
        {(searchQuery || searchTag) && <button onClick={() => { setSearchQuery(''); setSearchTag(''); }}>Clear</button>}
      </div>

      {/* 新規作成フォーム */}
      <div style={{ padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>Create New Task</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
          <input 
            type="text" placeholder="Title" value={newTask.title}
            onChange={e => setNewTask({...newTask, title: e.target.value})}
            style={{ flex: 2, padding: '8px' }}
          />
          {/* 期限日入力 */}
          <input 
            type="date" 
            value={newTask.due_date}
            onChange={e => setNewTask({...newTask, due_date: e.target.value})}
            style={{ flex: 1, padding: '8px' }}
          />
        </div>
        <input 
          type="text" placeholder="Tags (comma separated)" value={newTask.tagsStr}
          onChange={e => setNewTask({...newTask, tagsStr: e.target.value})}
          style={{ display: 'block', width: '100%', marginBottom: '5px', padding: '8px' }}
        />
        <textarea 
          placeholder="Description (Internal use only)" value={newTask.description}
          onChange={e => setNewTask({...newTask, description: e.target.value})}
          style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px', height: '60px' }}
        />
        <button onClick={handleCreate} disabled={loading}>Add Task</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>Tasks List</h2>
      </div>
      <hr />

      <div style={{ marginTop: '20px' }}>
        {tasks.map((task) => (
          <div key={task.id} style={{ 
            border: '1px solid #ccc', borderRadius: '8px', padding: '15px', marginBottom: '10px',
            backgroundColor: task.status === 'completed' ? '#e8f5e9' : 'white',
            display: 'flex', flexDirection: 'column', gap: '5px'
          }}>
            {editingId === task.id ? (
              // 編集モード
              <div>
                <input 
                  value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})}
                  style={{ width: '100%', marginBottom: '5px' }} placeholder="Title"
                />
                <input 
                  type="date"
                  value={editForm.due_date} onChange={e => setEditForm({...editForm, due_date: e.target.value})}
                  style={{ width: '100%', marginBottom: '5px' }}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: '0 0 5px 0' }}>#{task.id} {task.title}</h3>
                    {/* 期限日の表示 */}
                    <div style={{ fontSize: '0.9rem', color: task.due_date ? '#d32f2f' : '#888', fontWeight: 'bold' }}>
                      Due: {task.due_date ? task.due_date : 'No deadline'}
                    </div>
                  </div>

                  <div>
                    <button onClick={() => startEdit(task)}>Edit</button>
                    <button onClick={() => handleDelete(task.id)} style={{ marginLeft: '5px', color: 'red' }}>Delete</button>
                  </div>
                </div>

                {/* タグ表示 */}
                <div style={{ marginTop: '8px' }}>
                  {task.Tags && task.Tags.map(tag => (
                    <span key={tag.name} 
                      onClick={() => { setSearchTag(tag.name); }}
                      style={{ 
                        display: 'inline-block', backgroundColor: '#607D8B', color: 'white', 
                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', 
                        marginRight: '5px', cursor: 'pointer' 
                      }}>
                      {tag.name}
                    </span>
                  ))}
                </div>
                
                <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>
                  Status: 
                  <span onClick={() => toggleStatus(task)} style={{ cursor: 'pointer', color: 'blue', marginLeft: '5px', textDecoration: 'underline' }}>
                    {task.status}
                  </span>
                </p>
                
                {/* description は表示しない */}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;