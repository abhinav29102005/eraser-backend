module.exports = {
  PERMISSIONS: {
    VIEW: 'view',
    EDIT: 'edit',
    ADMIN: 'admin',
  },

  TOOLS: {
    PEN: 'pen',
    ERASER: 'eraser',
    RECTANGLE: 'rectangle',
    CIRCLE: 'circle',
    LINE: 'line',
    TEXT: 'text',
    SELECT: 'select',
  },

  SOCKET_EVENTS: {
    AUTHENTICATE: 'authenticate',
    AUTHENTICATED: 'authenticated',
    AUTH_ERROR: 'auth_error',
    JOIN_BOARD: 'join_board',
    LEAVE_BOARD: 'leave_board',
    BOARD_STATE: 'board_state',
    DRAWING_UPDATE: 'drawing_update',
    ELEMENT_DELETE: 'element_delete',
    BOARD_CLEAR: 'board_cleared',
    UNDO_ACTION: 'undo_action',
    REDO_ACTION: 'redo_action',
    USER_JOINED: 'user_joined',
    USER_LEFT: 'user_left',
    CURSOR_MOVE: 'cursor_move',
    CURSOR_ACTION: 'cursor_action',
    ERROR: 'error',
  },
};
