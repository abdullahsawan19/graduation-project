const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const path = require("path");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("@exortek/express-mongo-sanitize");
const sanitizeHtml = require("sanitize-html");
const hpp = require("hpp");
const cors = require("cors");
const compression = require("compression");

const connectDB = require("./config/db.config");

const globalErrorHandler = require("./controllers/error.Controller");
const notFound = require("./middlewares/notFound.middleware");
const chatRouter = require("./routes/chat.Routes");
const appointmentController = require("./controllers/appointment.Controller");

const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  }),
);

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

const limiter = rateLimit({
  max: 200,
  windowMs: 15 * 60 * 1000,
  message: "Too many requests from this IP, please try again in an 15 minutes!",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(
  "/api/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "30d",
    immutable: true,
  }),
);

app.use("/api", limiter);

app.post(
  "/webhook-checkout",
  express.raw({ type: "application/json" }),
  appointmentController.webhookCheckout,
);

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.use(
  mongoSanitize({
    replaceWith: "_",
  }),
);

app.use((req, res, next) => {
  if (req.body) {
    for (let key in req.body) {
      if (typeof req.body[key] === "string") {
        req.body[key] = sanitizeHtml(req.body[key], {
          allowedTags: [],
          allowedAttributes: {},
        });
      }
    }
  }
  next();
});

app.use(
  hpp({
    whitelist: [
      "fees",
      "ratingsQuantity",
      "ratingsAverage",
      "specialization",
      "role",
    ],
  }),
);

app.use(compression());

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

// Routes
app.use("/api/users", require("./routes/user.Routes"));
app.use("/api/doctors", require("./routes/doctor.Routes"));
app.use("/api/services", require("./routes/service.Routes"));
app.use("/api/branches", require("./routes/branch.Routes"));
app.use("/api/faqs", require("./routes/faq.Routes"));
app.use("/api/reviews", require("./routes/review.Routes"));
app.use("/api/appointments", require("./routes/appointment.Routes"));
app.use("/api/chat", chatRouter);

// 404 & Error Handling
app.use(notFound);
app.use(globalErrorHandler);

module.exports = app;
