const Modal = ({ onClose, children }) => {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-30 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full relative">
          <button onClick={onClose} className="absolute top-2 right-3 text-gray-600 text-lg">&times;</button>
          {children}
        </div>
      </div>
    );
  };
  
  export default Modal;
  
  