const express = require('express');
const { spawn } = require('child_process');
const net = require('net');

const app = express();
const PORT = process.env.PORT || 3000;

// === CẤU HÌNH MÁY CHỦ TXITY ===
const TXITY_SERVER = '127.0.0.1'; // <-- Thay bằng IP thật của server TXITY
const TXITY_PORT = 1234;          // <-- Thay bằng Port thật của server TXITY

// === DANH SÁCH 2 BÀI NHẠC ===
const PLAYLIST = ['nhac1.mp3', 'nhac2.mp3'];
let currentTrackIndex = 0;

// Tạo trang web nhỏ để Render kiểm tra hệ thống (Health Check)
app.get('/', (req, res) => {
    res.send('Trạm phát radio 24/7 đang chạy mượt mà!');
});

app.listen(PORT, () => {
    console.log(`[Web] Đang chạy tại port ${PORT}`);
});

// Hàm truyền âm thanh liên tục
function startStreaming() {
    const currentAudioFile = PLAYLIST[currentTrackIndex];
    console.log(`[Radio] Đang chuẩn bị phát: ${currentAudioFile}`);

    const client = new net.Socket();

    client.connect(TXITY_PORT, TXITY_SERVER, () => {
        console.log(`[Connected] Đang truyền luồng âm thanh sạch cho bài: ${currentAudioFile}`);

        // Dùng ffmpeg giải mã file nhạc thành luồng PCM thô (hệ thống Render tự nhận diện ffmpeg)
        const ffmpeg = spawn('ffmpeg', [
            '-re', '-i', currentAudioFile,
            '-f', 's16le', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '1', '-'
        ]);

        // Đẩy data nhạc thẳng qua cổng mạng kết nối với TXITY
        ffmpeg.stdout.on('data', (chunk) => {
            if (client.writable) {
                client.write(chunk);
            }
        });

        // Khi bài hiện tại phát xong, đổi sang bài tiếp theo
        ffmpeg.on('close', (code) => {
            console.log(`[Finished] Đã xong bài: ${currentAudioFile}`);
            client.destroy(); // Ngắt kết nối cũ

            // Chuyển sang bài số 2, nếu hết thì quay lại bài số 1
            currentTrackIndex = (currentTrackIndex + 1) % PLAYLIST.length;

            // Chờ 2 giây rồi tự động phát bài tiếp theo
            setTimeout(startStreaming, 2000);
        });
    });

    // Nếu rớt mạng hoặc lỗi server TXITY thì tự động kết nối lại sau 5 giây
    client.on('error', (err) => {
        console.error(`[Error] Lỗi kết nối: ${err.message}. Thử lại sau 5 giây...`);
        setTimeout(startStreaming, 5000);
    });
}

// Bắt đầu chạy trạm phát
startStreaming();
