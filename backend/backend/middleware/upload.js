// Configuração do multer para upload de fotos de produtos.
// Salva os arquivos em backend/uploads/products com um nome único,
// e valida que somente imagens sejam aceitas (segurança básica de upload).

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'products'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `produto-${Date.now()}-${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function fileFilter(req, file, cb) {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de imagem não suportado. Use JPG, PNG, WEBP ou GIF.'));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 8 }, // 5MB por arquivo, até 8 fotos
});

module.exports = upload;
