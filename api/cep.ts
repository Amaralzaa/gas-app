import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const { cep } = request.query;

  if (!cep || typeof cep !== 'string') {
    return response.status(400).json({ error: 'CEP is required' });
  }

  // Remove non-numeric characters
  const cleanCep = cep.replace(/\D/g, '');

  if (cleanCep.length !== 8) {
    return response.status(400).json({ error: 'Invalid CEP format' });
  }

  try {
    const fetchResponse = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    const data = await fetchResponse.json();

    if (data.erro) {
      return response.status(404).json({ error: 'CEP not found' });
    }

    return response.status(200).json(data);
  } catch (error) {
    console.error('CEP Proxy error:', error);
    return response.status(500).json({ error: 'Failed to fetch CEP data' });
  }
}
