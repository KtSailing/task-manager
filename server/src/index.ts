// server/src/index.ts
import express from 'express';
import cors from 'cors';
import { Sequelize, DataTypes, Model, Op } from 'sequelize'; // Opを追加

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

// --- モデル定義 ---

class Task extends Model {}
Task.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
}, { sequelize, modelName: 'Task' });

// Tagモデルの追加
class Tag extends Model {}
Tag.init({
  name: { type: DataTypes.STRING, unique: true, allowNull: false }
}, { sequelize, modelName: 'Tag', timestamps: false });

// リレーション設定 (多対多)
Task.belongsToMany(Tag, { through: 'TaskTags' });
Tag.belongsToMany(Task, { through: 'TaskTags' });

// --- 初期化 ---
const init = async () => {
  await sequelize.sync({ force: true });

  // ダミーデータ作成
  const tasks = await Task.bulkCreate([
    { title: '牛乳を買う', description: 'スーパーで牛乳と卵を買う', status: 'pending' },
    { title: 'レポート提出', description: '月曜日の朝までに提出', status: 'completed' },
    { title: 'ランニング', description: '公園を5km走る', status: 'pending' },
  ]);

  const tags = await Tag.bulkCreate([
    { name: '買い物' }, { name: '家事' }, { name: '大学' }, { name: '健康' }
  ]);

  // タグの関連付け
  // Task 1 (牛乳) -> 買い物, 家事
  await (tasks[0] as any).addTags([tags[0], tags[1]]);
  // Task 2 (レポート) -> 大学
  await (tasks[1] as any).addTags([tags[2]]);
  // Task 3 (ランニング) -> 健康
  await (tasks[2] as any).addTags([tags[3]]);

  console.log('Database initialized with tags.');
  app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
};

init();

// --- API ---

// 1. タスク一覧取得 (検索機能付き)
app.get('/tasks', async (req, res) => {
  const { q, tag } = req.query; // クエリパラメータ取得

  const whereClause: any = {};
  const includeClause: any = [];

  // キーワード検索 (タイトル or 詳細)
  if (q) {
    whereClause[Op.or] = [
      { title: { [Op.like]: `%${q}%` } },
      { description: { [Op.like]: `%${q}%` } }
    ];
  }

  // タグ検索
  if (tag) {
    includeClause.push({
      model: Tag,
      where: { name: tag }, // そのタグを持っているタスクに絞る
      attributes: [], // 中間テーブルの情報は不要
      through: { attributes: [] }
    });
  }

  const tasks = await Task.findAll({
    where: whereClause,
    include: includeClause,
    attributes: ['id', 'title'] // IDとTitleのみ返す
  });

  setTimeout(() => res.json(tasks), 100);
});

// 2. タスク詳細取得 (タグ情報も含める)
app.get('/tasks/:id', async (req, res) => {
  const task = await Task.findByPk(req.params.id, {
    include: [{
      model: Tag,
      attributes: ['name'],
      through: { attributes: [] } // 中間テーブルの情報を隠す
    }]
  });
  setTimeout(() => res.json(task), 100);
});

// 3. タスク作成 (タグ対応)
app.post('/tasks', async (req, res) => {
  try {
    const { title, description, tags } = req.body; // tagsは文字列配列 ["tag1", "tag2"]
    const task = await Task.create({ title, description });

    if (tags && Array.isArray(tags)) {
      // タグがあれば検索または作成して関連付け
      for (const tagName of tags) {
        const [tag] = await Tag.findOrCreate({ where: { name: tagName } });
        await (task as any).addTag(tag);
      }
    }
    res.json(task);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Create failed' });
  }
});

// 4. タスク更新 (タグ対応)
app.put('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, tags } = req.body;
    
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ error: 'Not found' });

    task.set({ title, description, status });
    await task.save();

    if (tags && Array.isArray(tags)) {
      // 既存のタグ関係を一度クリアして、新しいタグセットを適用するのが簡単
      await (task as any).setTags([]); 
      for (const tagName of tags) {
        const [tag] = await Tag.findOrCreate({ where: { name: tagName } });
        await (task as any).addTag(tag);
      }
    }

    res.json(task);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Update failed' });
  }
});

// 5. 削除 (変更なし)
app.delete('/tasks/:id', async (req, res) => {
  try {
    await Task.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Delete failed' }); }
});