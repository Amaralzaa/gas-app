import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Check, Upload, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LogoCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (croppedDataUrl: string) => void;
  initialImage?: string;
}

export const LogoCropperModal: React.FC<LogoCropperModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialImage
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(initialImage || null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (initialImage) {
      setImageSrc(initialImage);
    }
  }, [initialImage]);

  useEffect(() => {
    if (!isOpen) {
      setScale(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
    }
  }, [isOpen]);

  // Carregar imagem para tag de renderização
  useEffect(() => {
    if (imageSrc) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imgRef.current = img;
        draw();
      };
      img.src = imageSrc;
    }
  }, [imageSrc]);

  useEffect(() => {
    draw();
  }, [scale, rotation, offset]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 400;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    // Fundo branco limpo
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    // Centraliza o ponto de rotação e escala no meio do canvas
    ctx.translate(size / 2 + offset.x, size / 2 + offset.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);

    const img = imgRef.current;
    // Calcula tamanho para caber no canvas
    const maxDim = Math.max(img.width, img.height);
    const aspect = img.width / img.height;
    let drawW = size;
    let drawH = size;

    if (aspect > 1) {
      drawW = size * aspect;
      drawH = size;
    } else {
      drawW = size;
      drawH = size / aspect;
    }

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageSrc(event.target.result as string);
          setScale(1);
          setRotation(0);
          setOffset({ x: 0, y: 0 });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Suporte a Touch em dispositivos móveis
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - offset.x,
        y: e.touches[0].clientY - offset.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const finalDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onSave(finalDataUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-yellow-400 p-2 rounded-xl text-slate-900">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-lg">Ajustar e Redimensionar Logo</h3>
              <p className="text-xs text-slate-400 font-medium">Arraste e ajuste o enquadramento perfeito</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 flex flex-col items-center">
          {imageSrc ? (
            <div className="flex flex-col items-center gap-4 w-full">
              {/* Canvas com máscara circular */}
              <div 
                className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden border-4 border-yellow-400 shadow-xl bg-slate-100 cursor-move select-none touch-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <canvas
                  ref={canvasRef}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border border-black/10 rounded-full pointer-events-none" />
              </div>

              <p className="text-[11px] text-slate-400 font-medium">
                👆 Toque e arraste para posicionar a imagem
              </p>

              {/* Controles de Zoom e Rotação */}
              <div className="w-full bg-slate-50 p-4 rounded-2xl space-y-3 border border-slate-100">
                <div className="flex items-center gap-3">
                  <ZoomOut className="w-4 h-4 text-slate-400" />
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.05"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="flex-1 accent-yellow-500 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <ZoomIn className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-600 w-10 text-right">{Math.round(scale * 100)}%</span>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setRotation(r => (r + 90) % 360)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-slate-500" /> Girar 90°
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScale(1);
                      setRotation(0);
                      setOffset({ x: 0, y: 0 });
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    Resetar
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs font-bold text-yellow-700 bg-yellow-100 hover:bg-yellow-200 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" /> Escolher outra
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-56 border-2 border-dashed border-slate-300 hover:border-yellow-400 rounded-3xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all hover:bg-yellow-50/30 group"
            >
              <div className="bg-slate-100 group-hover:bg-yellow-100 p-4 rounded-2xl text-slate-400 group-hover:text-yellow-600 transition-colors mb-3">
                <Upload className="w-8 h-8" />
              </div>
              <p className="text-sm font-black text-slate-700 mb-1">Clique para selecionar a imagem da Logo</p>
              <p className="text-xs text-slate-400 font-medium">PNG, JPG ou WEBP (recomendado quadrado)</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-2xl border border-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!imageSrc}
            onClick={handleConfirm}
            className="flex-1 py-3 px-4 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" /> Salvar Logo
          </button>
        </div>
      </motion.div>
    </div>
  );
};
