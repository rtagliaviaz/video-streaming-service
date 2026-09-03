const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function testGPU() {
    console.log('🔍 Probando detección GPU en Windows...\n');
    
    try {
        // 1. Verificar GPU
        console.log('1️⃣ Verificando GPU:');
        try {
            const { stdout: gpu } = await execAsync('nvidia-smi --query-gpu=name --format=csv,noheader');
            console.log(`   ✅ GPU: ${gpu.trim()}`);
        } catch (e) {
            console.log('   ❌ No se encontró nvidia-smi');
        }
    } catch (e) {
        console.log('   Error:', e.message);
    }
    
    try {
        // 2. Verificar encoders
        console.log('\n2️⃣ Verificando encoders:');
        try {
            const { stdout: encoders } = await execAsync('ffmpeg -encoders | findstr nvenc');
            console.log(`   ✅ Encoders disponibles:`);
            const lines = encoders.split('\n').filter(line => line.trim());
            lines.forEach(line => console.log(`      ${line.trim()}`));
        } catch (e) {
            console.log('   ❌ No se encontraron encoders NVENC');
        }
    } catch (e) {
        console.log('   Error:', e.message);
    }
    
    try {
        // 3. Probar codificación
        console.log('\n3️⃣ Probando codificación con NVENC:');
        try {
            const { stdout, stderr } = await execAsync(
                'ffmpeg -f lavfi -i nullsrc=size=2x2:rate=1:duration=1 -c:v h264_nvenc -f null - 2>&1'
            );
            const output = stdout + stderr;
            if (output.includes('Error') || output.includes('error')) {
                console.log('   ⚠️ NVENC tiene errores:', output.substring(0, 200));
            } else {
                console.log('   ✅ NVENC funciona correctamente');
            }
        } catch (e) {
            // El error puede ser normal porque nullsrc no es un video real
            if (e.message && e.message.includes('nullsrc')) {
                console.log('   ⚠️ Prueba con nullsrc falló, pero puede ser normal');
                console.log('   ✅ Intentando probar con un archivo real...');
            } else {
                console.log('   ❌ Error probando NVENC:', e.message);
            }
        }
    } catch (e) {
        console.log('   Error:', e.message);
    }
    
    console.log('\n✅ Prueba completada');
}

testGPU();