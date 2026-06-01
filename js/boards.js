// ═══════════════════════════════════════════════════════════════════
// TABLEROS - Sin módulos
// ═══════════════════════════════════════════════════════════════════

const boardsContainer = document.getElementById('boards-container');

// Cargar tableros del usuario
async function loadBoards() {
  if (!window.currentUser) return;
  
  try {
    const snapshot = await db
      .collection('users')
      .doc(window.currentUser.uid)
      .collection('boards')
      .get();
    
    boardsContainer.innerHTML = '';
    
    if (snapshot.empty) {
      boardsContainer.innerHTML = '<p class="empty-state">No hay tableros. Crea uno para empezar.</p>';
      renderCreateBoardForm();
      return;
    }
    
    snapshot.forEach(doc => {
      const board = doc.data();
      const boardEl = createBoardElement(doc.id, board);
      boardsContainer.appendChild(boardEl);
    });
    
    renderCreateBoardForm();
    
  } catch (error) {
    console.error('Error cargando tableros:', error);
    window.showError(error);
  }
}

// Crear elemento de tablero
function createBoardElement(boardId, board) {
  const div = document.createElement('div');
  div.className = 'board-card';
  div.style.backgroundColor = board.background || '#0079bf';
  div.innerHTML = `
    <h3>${board.title}</h3>
    <div class="board-actions">
      <button class="btn-sm" onclick="openBoard('${boardId}')">Abrir</button>
      <button class="btn-sm btn-danger" onclick="deleteBoard('${boardId}')">Eliminar</button>
    </div>
  `;
  return div;
}

// Renderizar formulario de crear tablero
function renderCreateBoardForm() {
  const form = document.createElement('div');
  form.className = 'board-create';
  form.innerHTML = `
    <h3>+ Crear nuevo tablero</h3>
    <input type="text" id="new-board-name" placeholder="Nombre del tablero" />
    <input type="color" id="new-board-color" value="#0079bf" />
    <button onclick="createBoard()">Crear</button>
  `;
  boardsContainer.appendChild(form);
}

// Crear tablero
async function createBoard() {
  const name = document.getElementById('new-board-name').value;
  const color = document.getElementById('new-board-color').value;
  
  if (!name) {
    window.showToast('Ingresa un nombre para el tablero', 'error');
    return;
  }
  
  try {
    await db
      .collection('users')
      .doc(window.currentUser.uid)
      .collection('boards')
      .add({
        title: name,
        background: color,
        createdAt: new Date()
      });
    
    window.showToast('Tablero creado');
    loadBoards();
    
  } catch (error) {
    window.showError(error);
  }
}

// Abrir tablero
function openBoard(boardId) {
  // Guardar en localStorage para acceder desde board.html
  localStorage.setItem('selectedBoardId', boardId);
  window.location.href = 'board.html';
}

// Eliminar tablero
async function deleteBoard(boardId) {
  if (!confirm('¿Eliminar este tablero?')) return;
  
  try {
    await db
      .collection('users')
      .doc(window.currentUser.uid)
      .collection('boards')
      .doc(boardId)
      .delete();
    
    window.showToast('Tablero eliminado');
    loadBoards();
    
  } catch (error) {
    window.showError(error);
  }
}

// Cargar tableros al iniciar
if (window.currentUser) {
  loadBoards();
}
