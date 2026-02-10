@echo off
chcp 65001 > nul
title ごみ収集アシスタント - RAG System
cd /d "%~dp0"
call venv\Scripts\activate.bat
python start.py
pause
