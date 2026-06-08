const jwt = require("jsonwebtoken");
const User = require("../models/user.Model");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m",
  });
};

const signRefreshToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES || "9d",
    },
  );
};

const createSendToken = async (user, statusCode, res) => {
  const accessToken = signToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  user.password = undefined;
  user.refreshToken = undefined;

  const refreshExpires = parseInt(process.env.JWT_REFRESH_EXPIRES) || 9;

  const cookieOptions = {
    expires: new Date(Date.now() + refreshExpires * 24 * 60 * 60 * 1000),
    httpOnly: true,
    // secure: true,
    // sameSite: "None",
  };

  res.cookie("jwt", refreshToken, cookieOptions);
  res.status(statusCode).json({
    status: "success",
    message:
      statusCode === 201 ? "Account created successfully" : "Login successful",
    accessToken,
    data: { user },
  });
};

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError("Please provide email and password", 400));
  }

  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Invalid email or password", 401));
  }

  if (!user.isActive) {
    return next(
      new AppError("Your account is deactivated. Contact admin.", 403),
    );
  }

  await createSendToken(user, 200, res);
});

exports.logout = async (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    path: "/",
    secure: true,
    sameSite: "None",
  });

  if (req.user && req.user.id) {
    await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
  }

  res.status(200).json({ status: "success" });
};

exports.refreshToken = catchAsync(async (req, res, next) => {
  const cookieRefreshToken = req.cookies.jwt;

  if (!cookieRefreshToken) {
    return next(
      new AppError("No refresh token present! Please log in again.", 401),
    );
  }

  const decoded = jwt.verify(
    cookieRefreshToken,
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  );

  const currentUser = await User.findById(decoded.id).select("+refreshToken");

  if (!currentUser) {
    return next(
      new AppError("The user belonging to this token no longer exists.", 401),
    );
  }

  if (currentUser.refreshToken !== cookieRefreshToken) {
    return next(
      new AppError("Invalid Refresh Token. Please login again.", 403),
    );
  }

  const newAccessToken = signToken(currentUser._id);

  res.status(200).json({
    status: "success",
    accessToken: newAccessToken,
  });
});

exports.createSendToken = createSendToken;
