const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

const productDir = 'C:\\Users\\Administrator\\Desktop\\product_uploads';
const dataDir = 'C:\\Users\\Administrator\\Desktop\\product_data';
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(productDir)) fs.mkdirSync(productDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, productDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(__dirname));

// ============ UTILITY ============
function readJSON(filename) {
  const fp = path.join(dataDir, filename);
  if (!fs.existsSync(fp)) return [];
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}
function writeJSON(filename, data) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 2), 'utf-8');
}
function syncProductsToData() {
  const files = fs.readdirSync(productDir).filter(f => f.endsWith('.json'));
  const products = files.map(f => JSON.parse(fs.readFileSync(path.join(productDir, f), 'utf-8')))
    .sort((a, b) => b.timestamp - a.timestamp);
  writeJSON('products.json', products);
}

// ============ PRODUCTS ============
app.get('/api/products', (req, res) => {
  try {
    const files = fs.readdirSync(productDir).filter(f => f.endsWith('.json'));
    const products = files.map(f => {
      const data = fs.readFileSync(path.join(productDir, f), 'utf-8');
      return JSON.parse(data);
    }).sort((a, b) => b.timestamp - a.timestamp);
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const files = fs.readdirSync(productDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const data = JSON.parse(fs.readFileSync(path.join(productDir, f), 'utf-8'));
      if (data.id === req.params.id) return res.json(data);
    }
    res.status(404).json({ error: '未找到' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/products/:id', upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]), (req, res) => {
  try {
    const files = fs.readdirSync(productDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const data = JSON.parse(fs.readFileSync(path.join(productDir, f), 'utf-8'));
      if (data.id === req.params.id) {
        const { title, description, applicant, inventor, productNumber, applicationDate } = req.body;
        if (title) data.title = title;
        if (description) data.description = description;
        if (applicant !== undefined) data.applicant = applicant;
        if (inventor !== undefined) data.inventor = inventor;
        if (productNumber !== undefined) data.productNumber = productNumber;
        if (applicationDate !== undefined) data.applicationDate = applicationDate;
        data.timestamp = Date.now();
        if (req.files?.file?.[0]) data.file = { name: req.files.file[0].originalname, path: req.files.file[0].filename };
        if (req.files?.image?.[0]) data.image = { name: req.files.image[0].originalname, path: req.files.image[0].filename };
        fs.writeFileSync(path.join(productDir, f), JSON.stringify(data, null, 2), 'utf-8');
        syncProductsToData();
        return res.json({ success: true, product: data });
      }
    }
    res.status(404).json({ error: '未找到' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    const files = fs.readdirSync(productDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const data = JSON.parse(fs.readFileSync(path.join(productDir, f), 'utf-8'));
      if (data.id === req.params.id) {
        fs.unlinkSync(path.join(productDir, f));
        syncProductsToData();
        return res.json({ success: true });
      }
    }
    res.status(404).json({ error: '未找到' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/upload-product', upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]), (req, res) => {
  try {
    const { title, description, applicant, inventor, productNumber, applicationDate } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: '标题和描述为必填项' });
    }
    const product = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title, description,
      applicant: applicant || '', inventor: inventor || '',
      productNumber: productNumber || '', applicationDate: applicationDate || '',
      timestamp: Date.now(),
      file: req.files?.file?.[0] ? { name: req.files.file[0].originalname, path: req.files.file[0].filename } : null,
      image: req.files?.image?.[0] ? { name: req.files.image[0].originalname, path: req.files.image[0].filename } : null
    };
    fs.writeFileSync(path.join(productDir, `product_${product.id}.json`), JSON.stringify(product, null, 2), 'utf-8');
    syncProductsToData();
    res.json({ success: true, product });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ IMAGE UPLOAD ============
const uploadImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error('仅支持图片格式: jpg, png, gif, webp, svg, bmp'));
  }
});

app.post('/api/upload', uploadImage.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请选择图片' });
    const url = `/uploads/${req.file.filename}`;
    res.json({ success: true, url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use('/uploads', express.static(uploadsDir));

// ============ FEED ITEMS ============
app.get('/api/feed', (req, res) => {
  try {
    const items = readJSON('feed.json');
    res.json(items.sort((a, b) => b.timestamp - a.timestamp));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/feed', (req, res) => {
  try {
    const { title, description, author, promoted, imageUrl } = req.body;
    if (!title) return res.status(400).json({ error: '标题为必填项' });
    const items = readJSON('feed.json');
    const item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title, description: description || '',
      author: author || '创作者', promoted: !!promoted,
      imageUrl: imageUrl || '', timestamp: Date.now()
    };
    items.push(item);
    writeJSON('feed.json', items);
    res.json({ success: true, item });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/feed/:id', (req, res) => {
  try {
    const items = readJSON('feed.json');
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '未找到' });
    const { title, description, author, promoted, imageUrl } = req.body;
    if (title !== undefined) items[idx].title = title;
    if (description !== undefined) items[idx].description = description;
    if (author !== undefined) items[idx].author = author;
    if (promoted !== undefined) items[idx].promoted = !!promoted;
    if (imageUrl !== undefined) items[idx].imageUrl = imageUrl;
    items[idx].timestamp = Date.now();
    writeJSON('feed.json', items);
    res.json({ success: true, item: items[idx] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/feed/:id', (req, res) => {
  try {
    let items = readJSON('feed.json');
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: '未找到' });
    items = items.filter(i => i.id !== req.params.id);
    writeJSON('feed.json', items);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ MESSAGES (私信) ============
app.get('/api/messages', (req, res) => {
  try {
    res.json(readJSON('messages.json'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/messages', (req, res) => {
  try {
    const { text, sender } = req.body;
    if (!text) return res.status(400).json({ error: '消息内容不能为空' });
    const messages = readJSON('messages.json');
    const msg = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text, sender: sender || '用户',
      timestamp: Date.now(),
      replied: false
    };
    messages.push(msg);
    writeJSON('messages.json', messages);
    res.json({ success: true, message: msg });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/messages/:id/reply', (req, res) => {
  try {
    const messages = readJSON('messages.json');
    const msg = messages.find(m => m.id === req.params.id);
    if (!msg) return res.status(404).json({ error: '未找到' });
    msg.replied = true;
    msg.replyText = req.body.replyText || '';
    msg.repliedAt = Date.now();
    writeJSON('messages.json', messages);
    res.json({ success: true, message: msg });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ CART SUBMISSIONS (内容车) ============
app.get('/api/cart-submissions', (req, res) => {
  try {
    res.json(readJSON('cart.json'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/cart-submit', (req, res) => {
  try {
    const { note, items } = req.body;
    const submissions = readJSON('cart.json');
    const sub = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      note: note || '',
      items: items || [],
      timestamp: Date.now()
    };
    submissions.push(sub);
    writeJSON('cart.json', submissions);
    res.json({ success: true, submission: sub });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ USER PUBLISHED CONTENT ============
app.get('/api/user-posts', (req, res) => {
  try {
    res.json(readJSON('posts.json'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/user-publish', uploadImage.single('image'), (req, res) => {
  try {
    const { title, content, tag } = req.body;
    if (!title || !content) return res.status(400).json({ error: '标题和内容为必填项' });
    const posts = readJSON('posts.json');
    const post = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title, content, tag: tag || '',
      imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
      timestamp: Date.now(), approved: false
    };
    posts.push(post);
    writeJSON('posts.json', posts);
    res.json({ success: true, post });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/user-posts/:id/approve', (req, res) => {
  try {
    const posts = readJSON('posts.json');
    const post = posts.find(p => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: '未找到' });
    post.approved = req.body.approved !== false;
    writeJSON('posts.json', posts);
    res.json({ success: true, post });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`世界实物服务器启动: http://localhost:${PORT}`);
  console.log(`数据目录: ${dataDir}`);
});
