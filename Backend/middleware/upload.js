const multer = require('multer');
const path = require('path');
const fs = require('fs');

const createStorage = (folder) => multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, `../uploads/${folder}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const name = file.fieldname + '-' + uniqueSuffix + ext;
    cb(null, name);
  },
});

const imageFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const extname = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowed.test(file.mimetype);
  if (extname && mimetype) return cb(null, true);
  cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
};

const uploadCategory = multer({ storage: createStorage('categories'), fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadProduct = multer({ storage: createStorage('products'), fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadBanner = multer({ storage: createStorage('banners'), fileFilter: imageFilter, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadUser = multer({ storage: createStorage('users'), fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadBulk = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

module.exports = { uploadCategory, uploadProduct, uploadBanner, uploadUser, uploadBulk };
