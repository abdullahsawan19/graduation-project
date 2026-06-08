const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const AppError = require("../utils/appError");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new AppError("Not an image! Please upload only images.", 400), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 1024 * 1024 * 10 },
});

const resizeImage = async (req, res, next) => {
  if (!req.file) return next();

  const ext = "webp";
  const userId = req.user ? req.user.id : "admin";
  const uniqueName = `service-${userId}-${Date.now()}.${ext}`;

  const uploadPath = "/tmp";
  const filePath = path.join(uploadPath, uniqueName);

  try {
    await sharp(req.file.buffer)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .toFormat("webp")
      .webp({ quality: 80 })
      .toFile(filePath);

    req.file.filename = uniqueName;
    req.file.path = filePath;
    req.file.destination = uploadPath;

    next();
  } catch (error) {
    console.error("🔥 Sharp Error Details:", error);
    return next(new AppError("Error processing image", 500));
  }
};

module.exports = { upload, resizeImage };
