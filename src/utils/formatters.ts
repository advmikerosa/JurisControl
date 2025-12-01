
export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (dateString: string) => {
  if(!dateString) return '-';
  if (dateString.includes('T')) dateString = dateString.split('T')[0];
  if (dateString.includes('/')) return dateString;
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

export const masks = {
  cpf: (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14),
  cnpj: (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d)/, '$1-$2').substring(0, 18),
  phone: (v: string) => {
    const r = v.replace(/\D/g, '');
    if (r.length > 10) return r.replace(/^(\d\d)(\d{5})(\d{4}).*/, '($1) $2-$3');
    if (r.length > 5) return r.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    if (r.length > 2) return r.replace(/^(\d\d)(\d{0,5}).*/, '($1) $2');
    return r.replace(/^(\d*)/, '($1');
  },
  cep: (v: string) => v.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9),
  oab: (v: string) => {
      let val = v.toUpperCase().replace(/[^A-Z0-9]/g, ''); 
      if (val.length > 2 && /^[A-Z]{2}/.test(val)) {
         val = val.replace(/^([A-Z]{2})(\d)/, '$1/$2');
      }
      return val.substring(0, 10);
  },
  username: (v: string) => {
      let val = v.toLowerCase().replace(/[^a-z0-9._]/g, '');
      return val ? '@' + val.replace(/^@/, '') : '';
  }
};