// index.js
const express = require('express');
const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const program = new Command();

program
  .requiredOption('-h, --host <host>', 'Server host')
  .requiredOption('-p, --port <port>', 'Server port')
  .requiredOption('-c, --cache <path>', 'Cache directory path');

program.parse(process.argv);
const options = program.opts();

// Створення папки кешу, якщо не існує [cite: 253]
if (!fs.existsSync(options.cache)) {
    fs.mkdirSync(options.cache, { recursive: true });
}

const app = express();

// Налаштування парсингу JSON та форм
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Для x-www-form-urlencoded

// Налаштування multer для збереження фото в папку кешу
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, options.cache);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Унікальне ім'я
    }
});
const upload = multer({ storage: storage });

// Тимчасове сховище даних (масив)
let inventory = [];

app.get('/RegisterForm.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});

app.get('/SearchForm.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

app.post('/register', upload.single('photo'), (req, res) => {
    const { inventory_name, description } = req.body;
    if (!inventory_name) {
        return res.status(400).send('Bad Request: inventory_name is required');
    }

    const newItem = {
        id: Date.now().toString(), // Простий ID
        name: inventory_name,
        description: description,
        photo: req.file ? req.file.filename : null
    };

    inventory.push(newItem);
    res.status(201).send('Created');
});

app.get('/inventory', (req, res) => {
    res.json(inventory);
});

app.get('/inventory/:id', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    if (!item) return res.status(404).send('Not found');
    res.json(item);
});

app.put('/inventory/:id', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    if (!item) return res.status(404).send('Not found');

    const { name, description } = req.body;
    if (name) item.name = name;
    if (description) item.description = description;

    res.status(200).send('Updated');
});

app.delete('/inventory/:id', (req, res) => {
    const index = inventory.findIndex(i => i.id === req.params.id);
    if (index === -1) return res.status(404).send('Not found');

    // Опціонально: видалити файл фото з диску
    // const item = inventory[index];
    // if(item.photo) fs.unlinkSync(path.join(options.cache, item.photo));

    inventory.splice(index, 1);
    res.status(200).send('Deleted');
});

app.get('/inventory/:id/photo', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    if (!item || !item.photo) return res.status(404).send('Not found');

    res.sendFile(path.join(__dirname, options.cache, item.photo));
});

app.post('/search', (req, res) => {
    const { id, has_photo } = req.body; // x-www-form-urlencoded
    const item = inventory.find(i => i.id === id);

    if (!item) return res.status(404).send('Not Found');

    let responseData = { ...item };

    // Якщо прапорець has_photo (includePhoto) встановлено
    // У HTML формі checkbox передає 'on' якщо вибраний
    if (req.body.includePhoto === 'on' && item.photo) {
         responseData.description += ` (Photo: /inventory/${item.id}/photo)`;
    }

    res.json(responseData);
});

const swaggerDocument = YAML.load('./swagger.yaml');
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Запуск сервера [cite: 255]
app.listen(options.port, options.host, () => {
    console.log(`Server running at http://${options.host}:${options.port}`);
});