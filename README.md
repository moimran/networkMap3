# Network Diagram Tool

A modern network diagramming tool built with React, Vite, and jsPlumb. This tool allows network engineers to create, edit, and save network diagrams with a rich set of features.

## Features

- Drag and drop network device icons
- Connect devices with jsPlumb
- Zoom in/out and pan functionality
- Save and load diagram configurations
- Device interface management
- Modern and responsive UI

## Project Structure

```
networkMap3/
├── public/
│   ├── net_icons/      # Network device icons
│   ├── deviceconfig/   # Device interface configurations
│   └── diagrams/       # Saved diagram configurations
├── server/
│   └── index.js        # Express server for API endpoints
├── src/
│   ├── components/     # React components
│   └── App.jsx         # Main application component
└── package.json        # Project dependencies
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Start the backend server:
```bash
node server/index.js
```

## Usage

1. Drag and drop network device icons from the left panel onto the canvas
2. Right-click on devices to view and select interfaces
3. Connect devices by dragging from one interface to another
4. Use the toolbar to:
   - Save/load diagrams
   - Undo/redo changes
   - Delete elements
   - Zoom in/out

## Device Configuration

Device interface configurations are stored in JSON files under the `public/deviceconfig/` directory. Each device type has its own configuration file that defines its available interfaces.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT
