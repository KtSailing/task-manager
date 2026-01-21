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

// --- モデル定義 ---
class Task extends Model {}
Task.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  due_date: { type: DataTypes.DATEONLY },
  location: { type: DataTypes.STRING }, // --- 場所フィールドを追加 ---
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
}, { sequelize, modelName: 'Task' });

class Tag extends Model {}
Tag.init({
  name: { type: DataTypes.STRING, unique: true, allowNull: false }
}, { sequelize, modelName: 'Tag', timestamps: false });

Task.belongsToMany(Tag, { through: 'TaskTags' });
Tag.belongsToMany(Task, { through: 'TaskTags' });

// --- 初期化 ---
const init = async () => {
  await sequelize.sync({ force: true });

  // ダミーデータ作成 (locationを追加)
  // const tasks = await Task.bulkCreate([
  //   { title: '牛乳を買う', description: 'スーパーで牛乳と卵を買う', due_date: '2023-12-01', location: '近所のスーパー', status: 'pending' },
  //   { title: 'レポート提出', description: '月曜日の朝までに提出', due_date: '2023-11-20', location: '大学', status: 'completed' },
  //   { title: 'ランニング', description: '公園を5km走る', due_date: '2023-12-10', location: '中央公園', status: 'pending' },
  // ]);
  const tasks = await Task.bulkCreate([
    { title: '牛乳を買う', description: 'スーパーで牛乳と卵を買う', due_date: '2026-01-21', location: '近所のスーパー', status: 'pending' },
    { title: 'レポート提出', description: '月曜日の朝までに提出', due_date: '2026-01-26', location: '大学', status: 'completed' },
    { title: 'ランニング', description: '公園を5km走る', due_date: '2026-01-22', location: '中央公園', status: 'pending' },
    { title: '図書館へ返却', description: '借りていた技術書と小説を返す', due_date: '2026-01-22', location: '市立図書館', status: 'pending' },
    { title: '歯医者の定期検診', description: '午後3時に予約、保険証を忘れない', due_date: '2026-01-24', location: '駅前歯科クリニック', status: 'pending' },
    // { title: 'チームミーティング', description: 'プロジェクトの進捗報告と課題共有', due_date: '2026-01-20', location: 'オンライン (Zoom)', status: 'completed' },
    // { title: '電気代の支払い', description: 'コンビニで1月分の支払いを済ませる', due_date: '2026-01-25', location: 'セブンイレブン', status: 'pending' },
    // { title: '誕生日プレゼント購入', description: '友人のためにコーヒーメーカーを探す', due_date: '2026-01-23', location: 'ショッピングモール', status: 'pending' },
    // { title: '洗車', description: '週末のドライブに備えて洗車機にかける', due_date: '2026-01-18', location: 'ガソリンスタンド', status: 'completed' },
    // { title: 'プログラミング学習', description: 'Pythonのデータ分析チュートリアルを1章進める', due_date: '2026-01-30', location: '自宅', status: 'pending' },
    // { title: 'ライブチケット予約', description: '先行抽選の申し込み締め切り', due_date: '2026-01-21', location: 'チケットサイト', status: 'pending' },
    // { title: '粗大ゴミの申込み', description: '古い椅子の回収を依頼する', due_date: '2026-01-28', location: '市役所HP', status: 'pending' },
    // { title: 'ディナーの予約', description: '週末の食事会の席を確保する', due_date: '2026-01-19', location: 'イタリアンレストラン', status: 'completed' },
  ]);

  const tags = await Tag.bulkCreate([
    { name: '買い物' }, { name: '家事' }, { name: '大学' }, { name: '健康' }, {name: '学習'}
  ]);

  await (tasks[0] as any).addTags([tags[0], tags[1]]);
  await (tasks[1] as any).addTags([tags[2]]);
  await (tasks[2] as any).addTags([tags[3]]);
  await (tasks[3] as any).addTags([tags[4]]);
  await (tasks[4] as any).addTags([tags[3]]);
  

  console.log('Database initialized with locations.');
  app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
};

init();

// --- API ---

// 1. タスク一覧取得
app.get('/tasks', async (req, res) => {
  const { q, tag } = req.query;
  const whereClause: any = {};
  const includeClause: any = [];

  if (q) {
    whereClause[Op.or] = [
      { title: { [Op.like]: `%${q}%` } },
      { description: { [Op.like]: `%${q}%` } },
      { location: { [Op.like]: `%${q}%` } } // 場所も検索対象に追加
    ];
  }

  if (tag) {
    includeClause.push({
      model: Tag, where: { name: tag }, attributes: [], through: { attributes: [] }
    });
  }

  const tasks = await Task.findAll({
    where: whereClause,
    include: includeClause,
    attributes: ['id', 'title', 'due_date'], // 一覧は軽量のまま
    order: [['due_date', 'ASC']]
  });

  setTimeout(() => res.json(tasks), 100);
});

// 2. 詳細取得 (すべてのデータを返す)
app.get('/tasks/:id', async (req, res) => {
  // findByPkはデフォルトですべてのフィールドを取得します
  const task = await Task.findByPk(req.params.id, {
    include: [{
      model: Tag,
      attributes: ['name'],
      through: { attributes: [] }
    }]
  });
  setTimeout(() => res.json(task), 100);
});

// 3. 作成 (location対応)
app.post('/tasks', async (req, res) => {
  try {
    const { title, description, due_date, location, tags } = req.body;
    const task = await Task.create({ title, description, due_date, location });

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

// 4. 更新 (location対応)
app.put('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, due_date, location, tags } = req.body;
    
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ error: 'Not found' });

    task.set({ title, description, status, due_date, location }); // location更新
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