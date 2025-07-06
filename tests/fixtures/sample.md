---
trigger: "readme"
contentType: "text/markdown"
description: "README template for projects"
tags: ["documentation", "template"]
variables: ["projectName", "description"]
language: "markdown"
scope: "personal"
isActive: true
priority: 0
---

# {projectName}

## Description

{description}

## Installation

```bash
npm install {projectName}
```

## Usage

```javascript
const { projectName } = require("{projectName}");
```

## Features

- ✨ Easy to use
- 🚀 Fast performance
- 📝 Well documented

## Contributing

Pull requests are welcome! Please read our contributing guidelines.

## License

MIT License
