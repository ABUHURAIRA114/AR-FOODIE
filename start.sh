#!/bin/bash
cd frontend
npm install
npm run build
npx serve -l 5173 dist
