export const numeroMaxDosDecimales = (valor, defecto = "—") => {
  if (valor == null || valor === "" || Number.isNaN(Number(valor))) return defecto;
  const numero = Number(valor);
  return (Math.round((numero + Number.EPSILON) * 100) / 100).toString();
};

export const numeroDosDecimales = (valor) => {
  if (valor == null || valor === "" || Number.isNaN(Number(valor))) return 0;
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
};

