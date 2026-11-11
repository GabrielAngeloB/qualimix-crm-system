-- Permite que a role técnica atualize apenas nome e perfil dos usuários.
-- As demais colunas continuam protegidas pelos privilégios por coluna.

GRANT UPDATE (nome, perfil)
ON TABLE public.perfis
TO qualimix_app;
