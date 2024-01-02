function getUserDataFromToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
      if (err) {
        throw err;
      }
      resolve(userData);
    });
  });
}

module.exports = { getUserDataFromToken };
