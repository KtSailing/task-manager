// server/src/index.ts
import express from 'express';
import cors from 'cors';
import { Sequelize, DataTypes, Model } from 'sequelize';

const app = express();
const PORT = 3000;

// CORS許可 (Reactからのアクセス用)
app.use(cors());
app.use(express.json());

// SQLiteとSequelizeの設定
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false, // コンソールを汚さないようにSQLログはオフ
});

// タスクモデルの定義
class Task extends Model {}
Task.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT, // 詳細な内容
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
  },
  // SequelizeはデフォルトでcreatedAt, updatedAtを管理します
}, {
  sequelize,
  modelName: 'Task',
});

// データの初期化とサーバー起動
const init = async () => {
  await sequelize.sync({ force: true }); // 起動ごとにDBリセット

  // ダミーデータの作成 (5件)
  const tasksData = Array.from({ length: 5 }).map((_, i) => ({
    title: `Task ${i + 1}`,
    description: `これはタスク ${i + 1} の詳細な説明文です。サーバーから個別に取得されます。`,
    status: i % 2 === 0 ? 'completed' : 'pending',
  }));
  await Task.bulkCreate(tasksData);

  console.log('Database initialized with dummy data.');

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
};

init();

// --- API エンドポイント ---

// 1. タスク一覧取得 (軽量版: IDとTitleのみ)
app.get('/tasks', async (req, res) => {
  const tasks = await Task.findAll({
    attributes: ['id', 'title'] // 意図的に詳細情報を除外
  });
  // ネットワーク遅延をシミュレーションしてリクエストを見やすくする
  setTimeout(() => res.json(tasks), 100);
});

// 2. タスク詳細取得 (ID指定で全情報を取得)
app.get('/tasks/:id', async (req, res) => {
  const task = await Task.findByPk(req.params.id);
  // ネットワーク遅延をシミュレーション
  setTimeout(() => res.json(task), 100);
});

// server/src/index.ts
// ... (前回のコードの続き: app.get('/tasks/:id'...) の下に追加)

// 3. タスク作成 (Create)
app.post('/tasks', async (req, res) => {
  try {
    const { title, description } = req.body;
    const task = await Task.create({ title, description });
    res.json(task);
  } catch (e) {
    res.status(500).json({ error: 'Create failed' });
  }
});

// 4. タスク更新 (Update)
app.put('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status } = req.body;
    
    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // 値を更新して保存
    task.set({ title, description, status });
    await task.save();
    
    res.json(task);
  } catch (e) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// 5. タスク削除 (Delete)
app.delete('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Task.destroy({ where: { id } });
    
    if (result === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({ message: 'Deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Delete failed' });
  }
});