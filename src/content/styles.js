// Estilos inyectados dentro del Shadow DOM: aislados de YouTube.

export const css = `
  :host {
    all: initial;
  }
  * {
    box-sizing: border-box;
    font-family: "Roboto", "YouTube Sans", Arial, sans-serif;
  }
  .nj-root {
    /* En YouTube: absolute dentro del player.
       En YouTube Music: el host ya es fixed, así que usamos posición 0,0 */
    position: absolute;
    left: 12px;
    bottom: 60px;
    z-index: 60;
  }
  .nj-panel {
    background: rgba(20, 20, 20, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    padding: 8px 10px;
    color: #fff;
    width: 190px;
    user-select: none;
  }
  .nj-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .nj-title {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.3px;
  }
  .nj-toggle {
    background: none;
    border: none;
    color: #fbbf24;
    font-size: 14px;
    cursor: pointer;
    line-height: 1;
    padding: 2px 4px;
  }
  .nj-buttons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }
  .nj-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #eee;
    font-size: 11px;
    padding: 5px 0;
    cursor: pointer;
    transition: background 0.15s;
  }
  .nj-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  .nj-btn[data-active="true"] {
    background: #fbbf24;
    border-color: #fbbf24;
    color: #1a1a1a;
    font-weight: 700;
  }
  .nj-toast {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: 70px;
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    padding: 4px 12px;
    border-radius: 14px;
    font-size: 13px;
    pointer-events: none;
    white-space: nowrap;
  }
`
