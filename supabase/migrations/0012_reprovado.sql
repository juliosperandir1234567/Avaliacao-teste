-- Parecer "reprovado": nota geral abaixo da nota minima da avaliacao passa a ser marcada
-- explicitamente como reprovado, em vez de "necessita_treinamento".

alter type public.parecer add value 'reprovado';
