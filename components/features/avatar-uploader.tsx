'use client';

import { useRef, useState, useTransition } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { Avatar, Button, type AvatarSize } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { removerAvatar, salvarAvatar } from '@/lib/actions/profile';
import { cn } from '@/lib/utils';

/**
 * Envio da foto de perfil.
 *
 * O arquivo é redimensionado no navegador antes de subir. Não é enfeite: uma
 * foto de celular tem 4 MB e 4000 px, e o avatar aparece com 44 px. Cortar
 * para 512 px derruba o upload para poucas dezenas de kB, deixa o preview
 * instantâneo e evita estourar o teto do bucket.
 *
 * O upload vai direto do navegador para o Storage — a política já garante
 * que ninguém escreve fora da própria pasta — e a Server Action apenas
 * registra o caminho no perfil.
 */

const MAX_BYTES = 5 * 1024 * 1024; // antes de redimensionar
const TAMANHO_FINAL = 512;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export function AvatarUploader({
  userId,
  name,
  currentUrl,
  size = 'xl',
}: {
  userId: string;
  name: string;
  currentUrl: string | null;
  size?: AvatarSize;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = preview ?? currentUrl;

  async function handleFile(file: File) {
    setError(null);
    setNotice(null);

    if (!TIPOS.includes(file.type)) {
      setError('Use uma imagem JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('A imagem precisa ter no máximo 5 MB.');
      return;
    }

    let blob: Blob;
    try {
      blob = await resizeToSquare(file, TAMANHO_FINAL);
    } catch {
      setError('Não foi possível processar esta imagem. Tente outra.');
      return;
    }

    // Preview imediato: o usuário vê o resultado antes de o upload terminar.
    const localUrl = URL.createObjectURL(blob);
    setPreview(localUrl);

    startTransition(async () => {
      const supabase = createClient();
      const path = `${userId}/${crypto.randomUUID()}.webp`;

      const { error: uploadError } = await supabase.storage
        .from('avatares')
        .upload(path, blob, { contentType: 'image/webp', upsert: false });

      if (uploadError) {
        setPreview(null);
        URL.revokeObjectURL(localUrl);
        setError('Não foi possível enviar a imagem. Verifique sua conexão.');
        return;
      }

      const result = await salvarAvatar(path);

      if (!result.ok) {
        // O arquivo subiu mas o perfil não aceitou: desfaz para não deixar
        // órfão no bucket.
        await supabase.storage.from('avatares').remove([path]);
        setPreview(null);
        URL.revokeObjectURL(localUrl);
        setError(result.error ?? 'Não foi possível salvar a foto.');
        return;
      }

      setNotice('Foto atualizada.');
    });
  }

  const remove = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await removerAvatar();
      if (!result.ok) {
        setError(result.error ?? 'Não foi possível remover.');
        return;
      }
      setPreview(null);
      setNotice('Foto removida.');
    });
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar name={name} src={shown} size={size} ring />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          aria-label="Alterar foto de perfil"
          className={cn(
            'absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full',
            'border-2 border-surface bg-brand text-brand-on shadow-brand transition-transform',
            'hover:scale-105 active:scale-95 disabled:opacity-60',
          )}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Camera className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={Camera}
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            {shown ? 'Trocar foto' : 'Adicionar foto'}
          </Button>

          {shown && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={Trash2}
              disabled={pending}
              onClick={remove}
            >
              Remover
            </Button>
          )}
        </div>

        <p
          role={error ? 'alert' : undefined}
          className={cn(
            'mt-2 text-sm',
            error ? 'font-medium text-danger' : notice ? 'font-medium text-success' : 'text-muted',
          )}
        >
          {error ?? notice ?? 'JPG, PNG ou WEBP, até 5 MB. A imagem é recortada em quadrado.'}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Zera o input para que escolher o mesmo arquivo de novo dispare
          // o evento outra vez.
          e.target.value = '';
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}

/**
 * Recorta no centro e reduz para um quadrado de `size` px, em WEBP.
 *
 * O corte central é o que faz o resultado bater com o que a interface mostra:
 * o avatar é redondo, então esticar uma foto retangular deformaria o rosto.
 */
async function resizeToSquare(file: File, size: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const lado = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - lado) / 2;
  const sy = (bitmap.height - lado) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, sy, lado, lado, 0, 0, size, size);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('falha ao converter'))),
      'image/webp',
      0.86,
    );
  });
}
