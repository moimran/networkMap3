const express = require('express');
const path = require('path');
const iconsRouter = require('./routes/icons');

const app = express();

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../../public')));

// Use routes
app.use('/net_icons', iconsRouter);

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

module.exports = app;
