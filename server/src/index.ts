// server/src/index.ts
import express from 'express';
import cors from 'cors';
import { Sequelize, DataTypes, Model, Op } from 'sequelize';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

class Task extends Model {}
Task.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  due_date: { type: DataTypes.DATEONLY }, // --- 期限日を追加 (DATEONLY: 年月日のみ) ---
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
}, { sequelize, modelName: 'Task' });

class Tag extends Model {}
Tag.init({
  name: { type: DataTypes.STRING, unique: true, allowNull: false }
}, { sequelize, modelName: 'Tag', timestamps: false });

Task.belongsToMany(Tag, { through: 'TaskTags' });
Tag.belongsToMany(Task, { through: 'TaskTags' });

const init = async () => {
  await sequelize.sync({ force: true });

  // ダミーデータ作成 (期限日を追加)
  // 日付は YYYY-MM-DD 文字列で指定可能
  const tasks = await Task.bulkCreate([
    { title: '牛乳を買う', description: 'スーパーで牛乳と卵を買う', due_date: '2023-12-01', status: 'pending' },
    { title: 'レポート提出', description: '月曜日の朝までに提出', due_date: '2023-11-20', status: 'completed' }, // 期限切れ想定
    { title: 'ランニング', description: '公園を5km走る', due_date: '2023-12-10', status: 'pending' },
  ]);

  const tags = await Tag.bulkCreate([
    { name: '買い物' }, { name: '家事' }, { name: '大学' }, { name: '健康' }
  ]);

  await (tasks[0] as any).addTags([tags[0], tags[1]]);
  await (tasks[1] as any).addTags([tags[2]]);
  await (tasks[2] as any).addTags([tags[3]]);

  console.log('Database initialized with due dates.');
  app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
};

init();

// --- API ---

// 1. タスク一覧取得 (期限日が早い順)
app.get('/tasks', async (req, res) => {
  const { q, tag } = req.query;

  const whereClause: any = {};
  const includeClause: any = [];

  if (q) {
    whereClause[Op.or] = [
      { title: { [Op.like]: `%${q}%` } },
      { description: { [Op.like]: `%${q}%` } }
    ];
  }

  if (tag) {
    includeClause.push({
      model: Tag,
      where: { name: tag },
      attributes: [],
      through: { attributes: [] }
    });
  }

  const tasks = await Task.findAll({
    where: whereClause,
    include: includeClause,
    attributes: ['id', 'title', 'due_date'], // --- 一覧用に期限日も含める ---
    order: [['due_date', 'ASC']] // --- 期限日が早い順にソート ---
  });

  setTimeout(() => res.json(tasks), 100);
});

// 2. 詳細取得 (ここは変更なし。DescriptionやTagsを取得する)
app.get('/tasks/:id', async (req, res) => {
  const task = await Task.findByPk(req.params.id, {
    include: [{
      model: Tag,
      attributes: ['name'],
      through: { attributes: [] }
    }]
  });
  setTimeout(() => res.json(task), 100);
});

// 3. 作成 (期限日対応)
app.post('/tasks', async (req, res) => {
  try {
    const { title, description, due_date, tags } = req.body;
    const task = await Task.create({ title, description, due_date });

    if (tags && Array.isArray(tags)) {
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

// 4. 更新 (期限日対応)
app.put('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, due_date, tags } = req.body;
    
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ error: 'Not found' });

    task.set({ title, description, status, due_date }); // due_date更新
    await task.save();

    if (tags && Array.isArray(tags)) {
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

// 5. 削除
app.delete('/tasks/:id', async (req, res) => {
  try {
    await Task.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Delete failed' }); }
});