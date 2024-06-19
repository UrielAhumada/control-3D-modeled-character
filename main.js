// Importación de las dependencias necesarias de three.js
import * as THREE from './build/three.module.js'; // Cambia la ruta según la ubicación de tu three.module.js

import Stats from './jsm/libs/stats.module.js';
import { OrbitControls } from './jsm/controls/OrbitControls.js';
import { FBXLoader } from './jsm/loaders/FBXLoader.js';

// Declaración de variables globales
let camera, scene, renderer, stats, object, loader, mixer;
const clock = new THREE.Clock();
const step = 50; // La distancia que el personaje se mueve con cada pulsación de tecla
const cameraStep = 20; // Velocidad de movimiento de la cámara

// Parámetros para la interfaz gráfica
const params = {
    asset: 'Idle'
};

// Lista de activos disponibles
const assets = [
    'Idle',
    'Walk',
    'Run',
    'Jump',
    'Dying'
];

// Añadir evento para el control de la intensidad de la luz
const lightSlider = document.getElementById('light-slider');
    lightSlider.addEventListener('input', function () {
        const intensity = parseFloat(this.value);
        if (dirLight) {
            dirLight.intensity = intensity;
        }
        if (hemiLight) {
            hemiLight.intensity = intensity * 0.5;
        }
    });

    const fogSlider = document.getElementById('fog-slider');
    fogSlider.addEventListener('input', function () {
        const fogDistance = parseInt(this.value);
        scene.fog.far = fogDistance;
        scene.fog.near = fogDistance * 0.0005;
        renderer.render(scene, camera);
    });

// Coordenadas para el punto de referencia 'Idle'
let idleReferencePosition = new THREE.Vector3();

// Inicialización de la escena
init();

function init() {
    // Creación del contenedor y configuración de la cámara
    const container = document.createElement('div');
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(100, 200, 300);

    // Configuración de la escena incluyendo la niebla
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa0a0a0);
    const initialFogDistance = 1000;  // Valor inicial de la niebla
    scene.fog = new THREE.Fog(0xa0a0a0, initialFogDistance * 0.5, initialFogDistance); // Ajustar la niebla inicial

    // Configuración de la iluminación
    const hemiLight = new THREE.HemisphereLight('red', 'white', 5);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight('white', 5);
    dirLight.position.set(0, 200, 100);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 180;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    scene.add(dirLight);

    // Añadir suelo
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshPhongMaterial({ color: 0x000000, depthWrite: false }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Configuración del cargador FBX
    loader = new FBXLoader();
    loadAsset(params.asset);

    // Configuración del renderizador
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Configuración de los controles de órbita
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 100, 0);
    controls.update();

    // Añadir evento para ajustar el tamaño de la ventana
    window.addEventListener('resize', onWindowResize);

    // Añadir evento para las teclas numéricas del 1 al 5
    document.addEventListener('keydown', onKeyDown);

    // Añadir evento para las teclas de movimiento
    document.addEventListener('keydown', onMovementKeyDown);
    // Añadir evento para las teclas de movimiento de la cámara
    document.addEventListener('keydown', onCameraMoveKeyDown);

    // Configuración de las estadísticas
    stats = new Stats();
    container.appendChild(stats.dom);

    // Crear geometría y material para los cubos
    const geometry = new THREE.BoxGeometry(40, 40, 40);
    const blueMaterial = new THREE.MeshPhongMaterial({ color: 0x4169E1, flatShading: true });
    const characterBaseHeight = 100; // Asume que esta es la altura base del personaje, ajusta según tu modelo

    // Array para almacenar los cubos
    const cubes = [];

    // Iterar para crear los cubos
    for (let i = 0; i < 150; i++) {
        const mesh = new THREE.Mesh(geometry, blueMaterial); // Comienza con material azul por defecto

        // Habilitar sombras para los cubos
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Posicionar el cubo de manera aleatoria en el escenario
        mesh.position.x = Math.random() * 1600 - 800;
        mesh.position.y = characterBaseHeight; // Asegurar que el cubo esté al mismo nivel que el personaje
        mesh.position.z = Math.random() * 1600 - 800;

        mesh.updateMatrix();
        mesh.matrixAutoUpdate = false;

        scene.add(mesh);
        cubes.push(mesh);
    }

    // Configuración de blocker e instrucciones
    const blocker = document.getElementById('blocker');
    const instructions = document.getElementById('instructions');

    instructions.addEventListener('click', function () {
        blocker.style.display = 'none';
        controls.enabled = true;
    });

    // Función para cargar un activo FBX
    function loadAsset(asset) {
        loader.load('models/fbx/' + asset + '.fbx', function (group) {
            if (object) {
                // Liberar recursos del objeto anterior
                object.traverse(function (child) {
                    if (child.material) child.material.dispose();
                    if (child.material && child.material.map) child.material.map.dispose();
                    if (child.geometry) child.geometry.dispose();
                });
                scene.remove(object);
            }

            object = group;

            // Configuración de la animación
            if (object.animations && object.animations.length) {
                mixer = new THREE.AnimationMixer(object);
                const action = mixer.clipAction(object.animations[0]);
                action.play();
                action.clampWhenFinished = true; // Asegura que la acción se detenga en el último cuadro
                mixer.addEventListener('finished', onAnimationFinished); // Escucha el evento de finalización de la animación
            } else {
                mixer = null;
            }

            scene.add(object);

            // Si cargamos 'Idle', establecemos las nuevas coordenadas de referencia
            if (asset === 'Idle') {
                idleReferencePosition.copy(object.position);
            }

            console.log("Modelo cargado: ", object); // Log para verificar la carga
        });
    }

    // Función llamada al finalizar la animación
    function onAnimationFinished() {
        // Obtener las coordenadas finales del objeto
        const { x, y, z } = object.position;

        // Ejecutar la acción siguiente basada en las coordenadas finales
        // En este ejemplo, simplemente cargaremos la animación 'Idle'
        loadAsset('Idle');
    }

    // Función de animación
    function animate() {
        const delta = clock.getDelta();
        if (mixer) mixer.update(delta);
        renderer.render(scene, camera);
        stats.update();
        checkCollisions();
    }

    // Función para controlar el tamaño de la ventana
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Función para controlar las teclas numéricas
    function onKeyDown(event) {
        switch (event.keyCode) {
            case 32: // Tecla SPACE
                jump();
                break;
            case 49: // Tecla 1
                loadAsset('Idle');
                break;
            case 50: // Tecla 2
                loadAsset('Walk');
                break;
            case 51: // Tecla 3
                loadAsset('Run');
                break;
            case 52: // Tecla 4
                loadAsset('Jump');
                break;
            case 53: // Tecla 5
                loadAsset('Dying');
                break;
        }
    }

    // Función para el salto del personaje
    function jump() {
        if (!object || !object.animations || object.animations.length === 0) return;

        const jumpAction = mixer.clipAction(object.animations[1]); // Suponiendo que la animación de salto está en la posición 1 del array
        jumpAction.play();

        // Configurar la altura máxima y la velocidad de ascenso y descenso
        const jumpHeight = 100; // Altura máxima del salto
        const jumpDuration = 0.6; // Duración del salto (en segundos)

        // Variables para controlar el salto
        let jumpStart = null;
        let isJumping = false;

        // Función de animación para el salto
        function animateJump() {
            const currentTime = clock.getElapsedTime();

            if (!isJumping) {
                // Iniciar el salto
                jumpStart = currentTime;
                isJumping = true;
            }

            // Calcular la posición vertical durante el salto
            const elapsed = currentTime - jumpStart;
            const progress = Math.min(elapsed / jumpDuration, 1); // Progreso del salto (0 a 1)

            // Aplicar la posición vertical al objeto
            const y = jumpHeight * Math.sin(progress * Math.PI); // Movimiento sinusoidal para el salto
            object.position.y = y;

            if (progress === 1) {
                // Fin del salto
                isJumping = false;
                jumpAction.stop();
                loadAsset('Idle'); // Cargar la animación 'Idle' después del salto
            } else {
                // Continuar el salto
                requestAnimationFrame(animateJump);
            }
        }

        // Iniciar la animación del salto
        animateJump();
    }

    // Función para controlar las teclas de movimiento del personaje
    function onMovementKeyDown(event) {
        if (!object) return;

        // Obtener la dirección de movimiento basada en la rotación del personaje
        const direction = new THREE.Vector3();
        object.getWorldDirection(direction);

        switch (event.keyCode) {
            case 87: // Tecla W (adelante)
                moveForward(direction);
                break;
            case 83: // Tecla S (atrás)
                moveBackward(direction);
                break;
            case 65: // Tecla A (izquierda)
                moveLeft(direction);
                break;
            case 68: // Tecla D (derecha)
                moveRight(direction);
                break;
        }
    }

    // Función para mover hacia adelante
    function moveForward(direction) {
        object.translateZ(-step);
    }

    // Función para mover hacia atrás
    function moveBackward(direction) {
        object.translateZ(step);
    }

    // Función para mover a la izquierda
    function moveLeft(direction) {
        object.rotateY(Math.PI / 2);
        object.translateZ(-step);
    }

    // Función para mover a la derecha
    function moveRight(direction) {
        object.rotateY(-Math.PI / 2);
        object.translateZ(-step);
    }

    // Event listeners para el control de teclas
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keydown', onMovementKeyDown);

    // Función para actualizar la intensidad de la luz
    const lightSlider = document.getElementById('light-slider');
    lightSlider.addEventListener('input', function () {
        const intensity = parseFloat(this.value);
        if (dirLight) {
            dirLight.intensity = intensity;
        }
        if (hemiLight) {
            hemiLight.intensity = intensity * 0.5; // Ajustar según necesidades
        }
    });

    // Función para actualizar la densidad de la niebla
    const fogSlider = document.getElementById('fog-slider');
    fogSlider.addEventListener('input', function () {
        const density = parseFloat(this.value);
        if (scene && scene.fog) {
            scene.fog.density = density;
        }
    });

    // Función para controlar las teclas de movimiento de la cámara
    function onCameraMoveKeyDown(event) {
        // Obtener la dirección de la cámara
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);

        switch (event.keyCode) {
            case 38: // Tecla de flecha arriba (mueve la cámara hacia adelante)
                camera.position.addScaledVector(direction, cameraStep);
                break;
            case 40: // Tecla de flecha abajo (mueve la cámara hacia atrás)
                camera.position.addScaledVector(direction, -cameraStep);
                break;
            case 37: // Tecla de flecha izquierda (mueve la cámara hacia la izquierda)
                const left = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
                camera.position.addScaledVector(left, cameraStep);
                break;
            case 39: // Tecla de flecha derecha (mueve la cámara hacia la derecha)
                const right = new THREE.Vector3().crossVectors(direction, camera.up).normalize();
                camera.position.addScaledVector(right, cameraStep);
                break;
        }
        camera.updateProjectionMatrix();
    }

    // Función para detectar colisiones con los cubos
    function checkCollisions() {
        if (!object) return;
        const characterBox = new THREE.Box3().setFromObject(object);

        cubes.forEach(cube => {
            const cubeBox = new THREE.Box3().setFromObject(cube);
            if (characterBox.intersectsBox(cubeBox)) {
                console.log('Colisión detectada!');
                // Aquí puedes manejar la lógica de colisión, como detener la animación o cambiar la posición del personaje
            }
        });
    }
}