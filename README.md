# Lowe Frontend

A lightweight frontend for the Lowe school-assistant backend.

## Quick start

1. Install dependencies:
   npm install
2. Start the dev server:
   npm run dev
3. Open the local app in your browser.

## Backend

The app defaults to the deployed backend at:
https://lowe-backend-deepseek-api.vercel.app

You can override it with a local environment file:

- Copy `.env.example` to `.env`
- Update `VITE_API_BASE_URL`

## Features

- Translate between Chinese and your language
- Draft polite messages to teachers/admins
- Translate text from uploaded images
- Ask official school questions grounded in the backend knowledge base
