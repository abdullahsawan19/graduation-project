require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db.config");

connectDB();

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((err) => console.error("DB Connection Error:", err));
}

module.exports = app;
