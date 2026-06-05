@echo off

chcp 65001 >nul

title Rutin Değerlendirme Sistemi

cd /d "%~dp0"



set "PY=%~dp0venv\Scripts\python.exe"



if not exist "%PY%" (

    echo [HATA] Sanal ortam bulunamadi.

    echo.

    echo Ilk kurulum:

    echo   python -m venv venv

    echo   venv\Scripts\python.exe -m pip install -r requirements.txt

    echo.

    pause

    exit /b 1

)



if not exist "app.py" (

    echo [HATA] app.py bulunamadi.

    pause

    exit /b 1

)



"%PY%" -m pip show flask >nul 2>&1

if errorlevel 1 (

    echo Paketler kuruluyor, lutfen bekleyin...

    "%PY%" -m pip install -r requirements.txt

    if errorlevel 1 (

        echo [HATA] Paket kurulumu basarisiz.

        pause

        exit /b 1

    )

)



echo.

echo  Rutin Değerlendirme Sistemi

echo  ---------------------------

echo  Adres: http://127.0.0.1:5000

echo.



"%PY%" launcher.py



if errorlevel 1 (

    echo.

    echo [HATA] Uygulama baslatilamadi.

    pause

)


